import { Router } from 'express';
import pool from '../config/db.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { stripe, STRIPE_PRICE_ID, STRIPE_WEBHOOK_SECRET, isStripeConfigured } from '../utils/stripe.js';
import { GRACE_PERIOD_DAYS } from '../middleware/subscription.js';

const router = Router();

const APP_URL = process.env.APP_URL || 'http://localhost:5173';

function mapStripeStatus(status) {
  switch (status) {
    case 'active': return 'active';
    case 'trialing': return 'trialing';
    case 'past_due': return 'past_due';
    case 'paused': return 'suspended';
    case 'incomplete': return 'past_due';
    case 'canceled':
    case 'unpaid':
    case 'incomplete_expired':
      return 'canceled';
    default:
      return 'past_due';
  }
}

// Depuis l'API Stripe 2025+, current_period_end vit sur la subscription item
// (facturation multi-articles), plus sur la subscription elle-meme.
function periodEndOf(subscription) {
  const ts = subscription.items?.data?.[0]?.current_period_end;
  return ts ? new Date(ts * 1000) : null;
}

async function syncSubscription(subscription) {
  const status = mapStripeStatus(subscription.status);

  await pool.query(
    `UPDATE businesses SET
     subscription_status = $1,
     stripe_subscription_id = $2,
     current_period_end = $3,
     payment_failed_at = CASE
       WHEN $1 = 'active' THEN NULL
       WHEN $1 = 'past_due' AND payment_failed_at IS NULL THEN NOW()
       ELSE payment_failed_at
     END,
     updated_at = NOW()
     WHERE stripe_customer_id = $4`,
    [status, subscription.id, periodEndOf(subscription), subscription.customer]
  );
}

// GET /api/billing/status - Etat d'abonnement du commerce connecte (tous roles :
// sert a afficher le bandeau/l'ecran de blocage cote client, pas seulement au manager)
router.get('/status', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT subscription_status, plan, trial_ends_at, current_period_end, payment_failed_at
       FROM businesses WHERE id = $1`,
      [req.user.businessId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Commerce non trouvé' });
    res.json({ ...result.rows[0], gracePeriodDays: GRACE_PERIOD_DAYS });
  } catch (err) {
    console.error('Billing status error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération du statut' });
  }
});

// POST /api/billing/checkout - Cree une session Stripe Checkout pour demarrer l'abonnement
router.post('/checkout', authenticate, requireRole('manager'), async (req, res) => {
  if (!isStripeConfigured()) {
    return res.status(503).json({ error: 'Facturation non configurée (Stripe absent)' });
  }
  try {
    const biz = await pool.query('SELECT stripe_customer_id FROM businesses WHERE id = $1', [req.user.businessId]);
    if (!biz.rows.length) return res.status(404).json({ error: 'Commerce non trouvé' });

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
      customer: biz.rows[0].stripe_customer_id || undefined,
      client_reference_id: req.user.businessId,
      metadata: { businessId: req.user.businessId },
      subscription_data: { metadata: { businessId: req.user.businessId } },
      success_url: `${APP_URL}/settings?billing=success`,
      cancel_url: `${APP_URL}/settings?billing=cancel`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Create checkout session error:', err);
    res.status(500).json({ error: 'Erreur lors de la création de la session de paiement' });
  }
});

// POST /api/billing/portal - Portail Stripe (carte, factures, resiliation)
router.post('/portal', authenticate, requireRole('manager'), async (req, res) => {
  if (!isStripeConfigured()) {
    return res.status(503).json({ error: 'Facturation non configurée (Stripe absent)' });
  }
  try {
    const biz = await pool.query('SELECT stripe_customer_id FROM businesses WHERE id = $1', [req.user.businessId]);
    if (!biz.rows[0]?.stripe_customer_id) {
      return res.status(400).json({ error: 'Aucun abonnement Stripe actif pour ce commerce' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: biz.rows[0].stripe_customer_id,
      return_url: `${APP_URL}/settings`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Create portal session error:', err);
    res.status(500).json({ error: 'Erreur lors de la création du portail de facturation' });
  }
});

export default router;

// Handler webhook expose separement : monte dans index.js avec express.raw()
// AVANT express.json(), car Stripe signe le corps brut de la requete.
export async function stripeWebhookHandler(req, res) {
  if (!STRIPE_WEBHOOK_SECRET) {
    console.error('Stripe webhook reçu mais STRIPE_WEBHOOK_SECRET absent');
    return res.status(503).end();
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Signature webhook Stripe invalide:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const businessId = session.client_reference_id || session.metadata?.businessId;
        if (businessId && session.customer) {
          await pool.query(
            `UPDATE businesses SET stripe_customer_id = $1, updated_at = NOW() WHERE id = $2`,
            [session.customer, businessId]
          );
        }
        if (session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(session.subscription);
          await syncSubscription(subscription);
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await syncSubscription(event.data.object);
        break;
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        await pool.query(
          `UPDATE businesses SET subscription_status = 'canceled', updated_at = NOW() WHERE stripe_customer_id = $1`,
          [subscription.customer]
        );
        break;
      }
      case 'invoice.paid': {
        const invoice = event.data.object;
        await pool.query(
          `UPDATE businesses SET subscription_status = 'active', payment_failed_at = NULL, updated_at = NOW() WHERE stripe_customer_id = $1`,
          [invoice.customer]
        );
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        await pool.query(
          `UPDATE businesses SET subscription_status = 'past_due',
           payment_failed_at = COALESCE(payment_failed_at, NOW()), updated_at = NOW()
           WHERE stripe_customer_id = $1`,
          [invoice.customer]
        );
        break;
      }
      default:
        break;
    }
    res.json({ received: true });
  } catch (err) {
    console.error('Stripe webhook handling error:', err);
    res.status(500).json({ error: 'Erreur de traitement du webhook' });
  }
}
