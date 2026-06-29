import { Router } from 'express';
import pool from '../config/db.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_TYPES = ['percentage', 'fixed', 'free_delivery'];

// GET /api/promos - Liste des codes promo
router.get('/', authenticate, requireRole('manager'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT *,
       CASE WHEN is_active AND (expires_at IS NULL OR expires_at > NOW()) AND (max_uses IS NULL OR current_uses < max_uses) THEN true ELSE false END as is_valid
       FROM promo_codes WHERE business_id = $1 ORDER BY created_at DESC`,
      [req.user.businessId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('List promos error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des codes promo' });
  }
});

// GET /api/promos/:id - Détail d'un code promo
router.get('/:id', authenticate, requireRole('manager'), async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'ID invalide' });
  try {
    const result = await pool.query(
      'SELECT * FROM promo_codes WHERE id = $1 AND business_id = $2',
      [req.params.id, req.user.businessId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Code promo non trouvé' });

    const usageStats = await pool.query(
      `SELECT COUNT(*) as order_count, COALESCE(SUM(discount_amount), 0) as total_discount
       FROM orders WHERE promo_code_id = $1 AND status != 'cancelled'`,
      [req.params.id]
    );

    res.json({ ...result.rows[0], usage: usageStats.rows[0] });
  } catch (err) {
    console.error('Get promo error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération du code promo' });
  }
});

// POST /api/promos - Créer un code promo
router.post('/', authenticate, requireRole('manager'), async (req, res) => {
  const { code, type, value, minOrderAmount, maxUses, startsAt, expiresAt } = req.body;

  if (!code?.trim() || code.trim().length < 3) {
    return res.status(400).json({ error: 'Code requis (3 caractères minimum)' });
  }
  if (!VALID_TYPES.includes(type)) {
    return res.status(400).json({ error: `Type invalide. Choix: ${VALID_TYPES.join(', ')}` });
  }
  if (type === 'percentage') {
    const v = parseFloat(value);
    if (isNaN(v) || v <= 0 || v > 100) {
      return res.status(400).json({ error: 'Pourcentage: valeur entre 1 et 100' });
    }
  }
  if (type === 'fixed') {
    const v = parseFloat(value);
    if (isNaN(v) || v <= 0) {
      return res.status(400).json({ error: 'Montant fixe: valeur > 0' });
    }
  }
  if (maxUses !== undefined && maxUses !== null && (isNaN(maxUses) || parseInt(maxUses) < 1)) {
    return res.status(400).json({ error: 'Nombre max d\'utilisations: entier >= 1' });
  }
  if (startsAt && expiresAt && new Date(startsAt) >= new Date(expiresAt)) {
    return res.status(400).json({ error: 'La date de début doit être antérieure à la date de fin' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO promo_codes (business_id, code, type, value, min_order_amount, max_uses, starts_at, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.user.businessId, code.trim().toUpperCase(), type,
       type === 'free_delivery' ? 0 : parseFloat(value) || 0,
       parseFloat(minOrderAmount) || 0,
       maxUses ? parseInt(maxUses) : null,
       startsAt || null, expiresAt || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ce code promo existe déjà' });
    }
    console.error('Create promo error:', err);
    res.status(500).json({ error: 'Erreur lors de la création du code promo' });
  }
});

// PUT /api/promos/:id - Modifier un code promo
router.put('/:id', authenticate, requireRole('manager'), async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'ID invalide' });

  const { type, value, minOrderAmount, maxUses, startsAt, expiresAt, isActive } = req.body;

  try {
    const existing = await pool.query(
      'SELECT * FROM promo_codes WHERE id = $1 AND business_id = $2',
      [req.params.id, req.user.businessId]
    );
    if (!existing.rows.length) return res.status(404).json({ error: 'Code promo non trouvé' });

    const result = await pool.query(
      `UPDATE promo_codes SET type = COALESCE($1, type), value = COALESCE($2, value),
       min_order_amount = COALESCE($3, min_order_amount), max_uses = $4,
       starts_at = $5, expires_at = $6, is_active = COALESCE($7, is_active)
       WHERE id = $8 AND business_id = $9 RETURNING *`,
      [type, value != null ? parseFloat(value) : null,
       minOrderAmount != null ? parseFloat(minOrderAmount) : null,
       maxUses !== undefined ? (maxUses ? parseInt(maxUses) : null) : existing.rows[0].max_uses,
       startsAt !== undefined ? (startsAt || null) : existing.rows[0].starts_at,
       expiresAt !== undefined ? (expiresAt || null) : existing.rows[0].expires_at,
       isActive, req.params.id, req.user.businessId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update promo error:', err);
    res.status(500).json({ error: 'Erreur lors de la modification du code promo' });
  }
});

// PATCH /api/promos/:id - Activer/désactiver
router.patch('/:id', authenticate, requireRole('manager'), async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'ID invalide' });
  const { isActive } = req.body;
  if (typeof isActive !== 'boolean') {
    return res.status(400).json({ error: 'isActive doit être un booléen' });
  }

  try {
    const result = await pool.query(
      'UPDATE promo_codes SET is_active = $1 WHERE id = $2 AND business_id = $3 RETURNING *',
      [isActive, req.params.id, req.user.businessId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Code promo non trouvé' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Toggle promo error:', err);
    res.status(500).json({ error: 'Erreur lors de la modification du code promo' });
  }
});

// DELETE /api/promos/:id
router.delete('/:id', authenticate, requireRole('manager'), async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'ID invalide' });

  try {
    const usage = await pool.query(
      'SELECT COUNT(*) as c FROM orders WHERE promo_code_id = $1',
      [req.params.id]
    );
    if (parseInt(usage.rows[0].c) > 0) {
      await pool.query(
        'UPDATE promo_codes SET is_active = false WHERE id = $1 AND business_id = $2',
        [req.params.id, req.user.businessId]
      );
      return res.json({ success: true, message: 'Code promo désactivé (utilisé dans des commandes)' });
    }

    const result = await pool.query(
      'DELETE FROM promo_codes WHERE id = $1 AND business_id = $2 RETURNING id',
      [req.params.id, req.user.businessId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Code promo non trouvé' });
    res.json({ success: true, message: 'Code promo supprimé' });
  } catch (err) {
    console.error('Delete promo error:', err);
    res.status(500).json({ error: 'Erreur lors de la suppression du code promo' });
  }
});

// POST /api/promos/validate - Valider un code promo (pour l'interface client)
router.post('/validate', async (req, res) => {
  const { code, businessId, subtotal } = req.body;

  if (!code?.trim()) return res.status(400).json({ error: 'Code requis' });
  if (!businessId || !UUID_RE.test(businessId)) return res.status(400).json({ error: 'businessId requis' });

  try {
    const promo = await pool.query(
      `SELECT id, code, type, value, min_order_amount, max_uses, current_uses, expires_at
       FROM promo_codes WHERE code = $1 AND business_id = $2 AND is_active = true
       AND (starts_at IS NULL OR starts_at <= NOW()) AND (expires_at IS NULL OR expires_at > NOW())
       AND (max_uses IS NULL OR current_uses < max_uses)`,
      [code.trim().toUpperCase(), businessId]
    );

    if (!promo.rows.length) {
      return res.status(404).json({ valid: false, error: 'Code promo invalide ou expiré' });
    }

    const p = promo.rows[0];
    const orderSubtotal = parseFloat(subtotal) || 0;

    if (orderSubtotal < parseFloat(p.min_order_amount)) {
      return res.json({
        valid: false,
        error: `Commande minimum de ${parseFloat(p.min_order_amount).toFixed(2)} € requise`,
        minOrderAmount: parseFloat(p.min_order_amount),
      });
    }

    let discount = 0;
    let description = '';
    if (p.type === 'percentage') {
      discount = orderSubtotal * (parseFloat(p.value) / 100);
      description = `${p.value}% de réduction`;
    } else if (p.type === 'fixed') {
      discount = Math.min(parseFloat(p.value), orderSubtotal);
      description = `${parseFloat(p.value).toFixed(2)} € de réduction`;
    } else if (p.type === 'free_delivery') {
      discount = 2.50;
      description = 'Livraison offerte';
    }

    res.json({
      valid: true,
      code: p.code,
      type: p.type,
      discount: parseFloat(discount.toFixed(2)),
      description,
      expiresAt: p.expires_at,
    });
  } catch (err) {
    console.error('Validate promo error:', err);
    res.status(500).json({ error: 'Erreur lors de la validation du code promo' });
  }
});

export default router;
