import { Router } from 'express';
import pool from '../config/db.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { requirePlanModule } from '../middleware/planGate.js';
import { generateOrderNumber } from '../utils/order-number.js';
import { getIO } from '../index.js';
import {
  isUberEatsConfigured,
  isDeliverooConfigured,
  verifyUberEatsSignature,
  verifyDeliverooSignature,
  getUberEatsAccessToken,
} from '../utils/platformIntegrations.js';

const router = Router();

function notifyBusiness(businessId, event, data) {
  try {
    const io = getIO();
    if (io) io.to(`business:${businessId}`).emit(event, data);
  } catch {}
}

// ============================================================
// PARAMETRAGE (authentifie, gestionnaire, forfait Premium)
// ============================================================

// GET /api/integrations - statut de connexion Uber Eats / Deliveroo
router.get('/', authenticate, requirePlanModule('integrations'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT uber_eats_store_id, uber_eats_enabled, deliveroo_site_id, deliveroo_enabled
       FROM businesses WHERE id = $1`,
      [req.user.businessId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Commerce non trouvé' });
    const b = result.rows[0];
    res.json({
      uberEats: {
        available: isUberEatsConfigured(),
        storeId: b.uber_eats_store_id,
        enabled: b.uber_eats_enabled,
      },
      deliveroo: {
        available: isDeliverooConfigured(),
        siteId: b.deliveroo_site_id,
        enabled: b.deliveroo_enabled,
      },
    });
  } catch (err) {
    console.error('Get integrations error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des intégrations' });
  }
});

// PUT /api/integrations/uber-eats - enregistrer l'identifiant de boutique
router.put('/uber-eats', authenticate, requireRole('manager'), requirePlanModule('integrations'), async (req, res) => {
  if (!isUberEatsConfigured()) {
    return res.status(503).json({ error: "Intégration Uber Eats indisponible : partenariat en attente d'homologation" });
  }
  const { storeId, enabled } = req.body;
  try {
    await pool.query(
      `UPDATE businesses SET uber_eats_store_id = $1, uber_eats_enabled = $2, updated_at = NOW() WHERE id = $3`,
      [storeId?.trim() || null, Boolean(enabled), req.user.businessId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('Update Uber Eats integration error:', err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour' });
  }
});

// PUT /api/integrations/deliveroo - enregistrer l'identifiant de boutique
router.put('/deliveroo', authenticate, requireRole('manager'), requirePlanModule('integrations'), async (req, res) => {
  if (!isDeliverooConfigured()) {
    return res.status(503).json({ error: "Intégration Deliveroo indisponible : partenariat en attente d'homologation" });
  }
  const { siteId, enabled } = req.body;
  try {
    await pool.query(
      `UPDATE businesses SET deliveroo_site_id = $1, deliveroo_enabled = $2, updated_at = NOW() WHERE id = $3`,
      [siteId?.trim() || null, Boolean(enabled), req.user.businessId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('Update Deliveroo integration error:', err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour' });
  }
});

// ============================================================
// CREATION DE COMMANDE A PARTIR D'UNE PLATEFORME EXTERNE
// ============================================================

// Reprend le pattern de creation d'orders.js (transaction, order_items,
// historique, notification temps reel) sans decrement de stock ni promo -
// le catalogue Uber Eats/Deliveroo n'est pas (encore) synchronise avec les
// produits RestoLab, donc product_id reste NULL sur les lignes importees.
// payment_status est laisse a sa valeur par defaut ('pending') : le paiement
// est deja collecte par la plateforme, mais le faire transiter par le statut
// 'paid' RestoLab declenche la chaine fiscale NF525 (voir orders.js) - la
// bonne politique de reconciliation comptable pour ces commandes reste a
// definir avant mise en production.
async function createOrderFromExternalPlatform({ businessId, source, externalOrderId, customerName, customerPhone, deliveryAddress, deliveryNotes, items, deliveryFee }) {
  const existing = await pool.query(
    'SELECT * FROM orders WHERE business_id = $1 AND source = $2 AND external_order_id = $3',
    [businessId, source, externalOrderId]
  );
  if (existing.rows.length) return existing.rows[0];

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const subtotal = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
    const fee = deliveryFee || 0;
    const total = Math.max(0, subtotal + fee);
    const orderNumber = await generateOrderNumber();

    const orderResult = await client.query(
      `INSERT INTO orders (business_id, order_number, customer_name, customer_phone,
       delivery_address, delivery_notes, subtotal, delivery_fee, total, payment_method,
       order_type, status, source, external_order_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'card','delivery','preparing',$10,$11) RETURNING *`,
      [businessId, orderNumber, customerName?.trim() || `Client ${source}`, customerPhone?.trim() || '',
       deliveryAddress?.trim() || `Livraison ${source}`, deliveryNotes?.trim() || null,
       subtotal, fee, total, source, externalOrderId]
    );
    const order = orderResult.rows[0];

    for (const item of items) {
      await client.query(
        `INSERT INTO order_items (order_id, product_name, quantity, unit_price, total_price)
         VALUES ($1,$2,$3,$4,$5)`,
        [order.id, item.name, item.quantity, item.unitPrice, item.unitPrice * item.quantity]
      );
    }

    await client.query(
      `INSERT INTO order_status_history (order_id, status, note) VALUES ($1, 'preparing', $2)`,
      [order.id, `Commande importée automatiquement depuis ${source === 'uber_eats' ? 'Uber Eats' : 'Deliveroo'} — paiement déjà collecté par la plateforme`]
    );

    await client.query('COMMIT');

    notifyBusiness(businessId, 'order:new', { orderNumber: order.order_number, customerName: order.customer_name, total: order.total });
    return order;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// ============================================================
// WEBHOOKS (corps brut, montes dans index.js avant express.json())
// ============================================================

// POST /api/integrations/uber-eats/webhook
// Le webhook Uber Eats ne transporte qu'une notification (event_type,
// resource_href) ; le detail complet de la commande se recupere via un GET
// authentifie (OAuth2 client_credentials) sur resource_href. La structure
// exacte du JSON renvoye (noms des champs client/adresse/articles) n'a pas pu
// etre confirmee via la documentation publique : elle est journalisee en
// entier ci-dessous pour etre validee sur une vraie commande sandbox avant
// d'ecrire le mapping vers createOrderFromExternalPlatform(...).
export async function uberEatsWebhookHandler(req, res) {
  const signature = req.headers['x-uber-signature'];
  if (!isUberEatsConfigured() || !verifyUberEatsSignature(req.body, signature)) {
    return res.status(401).json({ error: 'Signature invalide ou intégration non configurée' });
  }

  let payload;
  try {
    payload = JSON.parse(req.body.toString('utf8'));
  } catch {
    return res.status(400).json({ error: 'JSON invalide' });
  }

  console.log('Uber Eats webhook reçu:', payload.event_type, payload.meta?.resource_id || payload.meta?.status);

  try {
    if (payload.event_type === 'orders.notification' && payload.resource_href) {
      const token = await getUberEatsAccessToken();
      const orderRes = await fetch(payload.resource_href, { headers: { Authorization: `Bearer ${token}` } });
      if (!orderRes.ok) {
        console.error(`Uber Eats: échec de récupération de la commande (${orderRes.status})`);
      } else {
        const order = await orderRes.json();
        console.log('Uber Eats order détail reçu:', JSON.stringify(order));
        // TODO : mapper les champs reels (confirmes via les logs ci-dessus
        // sur une commande de test) vers createOrderFromExternalPlatform(...).
      }
    }
  } catch (err) {
    console.error('Uber Eats webhook processing error:', err);
  }

  res.status(200).json({ ok: true });
}

// POST /api/integrations/deliveroo/webhook
// Contrairement a Uber Eats, les evenements Deliveroo (new_order, ...)
// transportent generalement la commande complete dans le corps du webhook.
// Le mapping exact des champs (structure "order", articles, adresse) n'a pas
// pu etre confirme sans acces partenaire actif : normalisation best-effort
// ci-dessous, a valider sur les payloads reels une fois l'homologation
// obtenue avant activation en production.
export async function deliverooWebhookHandler(req, res) {
  const guid = req.headers['x-deliveroo-sequence-guid'];
  const signature = req.headers['x-deliveroo-hmac-sha256'];
  if (!isDeliverooConfigured() || !verifyDeliverooSignature(req.body, guid, signature)) {
    return res.status(401).json({ error: 'Signature invalide ou intégration non configurée' });
  }

  let payload;
  try {
    payload = JSON.parse(req.body.toString('utf8'));
  } catch {
    return res.status(400).json({ error: 'JSON invalide' });
  }

  console.log('Deliveroo webhook reçu:', payload.event, payload.body?.order?.id);

  try {
    if (payload.event === 'order.new' && payload.body?.order) {
      const order = payload.body.order;
      const business = await pool.query('SELECT id FROM businesses WHERE deliveroo_site_id = $1 AND deliveroo_enabled = true', [String(payload.body.location?.id || '')]);
      if (business.rows.length) {
        await createOrderFromExternalPlatform({
          businessId: business.rows[0].id,
          source: 'deliveroo',
          externalOrderId: String(order.id),
          customerName: order.customer?.name,
          customerPhone: order.customer?.phone_number,
          deliveryAddress: order.delivery?.address?.address1,
          deliveryNotes: order.customer?.note,
          items: (order.items || []).map(i => ({
            name: i.name,
            quantity: i.quantity || 1,
            unitPrice: (i.total_price?.fractional ?? 0) / 100,
          })),
          deliveryFee: 0,
        });
      } else {
        console.log('Deliveroo webhook: aucun commerce connecté pour ce site_id, événement ignoré');
      }
    }
  } catch (err) {
    console.error('Deliveroo order import error:', err);
    // On accuse quand meme reception pour eviter une tempete de retries ;
    // l'erreur est journalisee pour investigation manuelle.
  }

  res.status(200).json({ ok: true });
}

export default router;
