import { Router } from 'express';
import bcrypt from 'bcrypt';
import pool from '../config/db.js';
import { generatePlatformToken, authenticatePlatform } from '../middleware/platformAuth.js';
import { PLANS } from '../config/plans.js';

const router = Router();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_STATUSES = ['trialing', 'active', 'past_due', 'canceled', 'suspended'];

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email?.trim() || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis' });
  }

  try {
    const result = await pool.query(
      'SELECT * FROM platform_admins WHERE email = $1 AND is_active = true',
      [email.trim().toLowerCase()]
    );
    if (!result.rows.length) {
      return res.status(401).json({ error: 'Identifiants invalides' });
    }

    const admin = result.rows[0];
    const valid = await bcrypt.compare(password, admin.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Identifiants invalides' });
    }

    await pool.query('UPDATE platform_admins SET last_login = NOW() WHERE id = $1', [admin.id]);

    res.json({
      token: generatePlatformToken(admin),
      admin: { id: admin.id, email: admin.email, firstName: admin.first_name, lastName: admin.last_name },
    });
  } catch (err) {
    console.error('Platform admin login error:', err);
    res.status(500).json({ error: 'Erreur lors de la connexion' });
  }
});

// GET /api/platform-admin/businesses - Liste de tous les commerces + statut abonnement
router.get('/businesses', authenticatePlatform, async (req, res) => {
  const { status } = req.query;
  try {
    const params = [];
    let where = '';
    if (status && VALID_STATUSES.includes(status)) {
      params.push(status);
      where = 'WHERE subscription_status = $1';
    }

    const result = await pool.query(
      `SELECT id, name, phone, subscription_status, plan, trial_ends_at, current_period_end,
       payment_failed_at, stripe_customer_id, created_at
       FROM businesses ${where} ORDER BY created_at DESC`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    console.error('List businesses error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des commerces' });
  }
});

// PATCH /api/platform-admin/businesses/:id/subscription - Override manuel (support)
// Permet aussi de forcer le forfait (plan) independamment de Stripe, utile
// pour donner un acces complet a un commerce sans abonnement actif.
router.patch('/businesses/:id/subscription', authenticatePlatform, async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'ID invalide' });

  const { subscriptionStatus, trialEndsAt, plan } = req.body;
  if (subscriptionStatus && !VALID_STATUSES.includes(subscriptionStatus)) {
    return res.status(400).json({ error: `Statut invalide. Choix: ${VALID_STATUSES.join(', ')}` });
  }
  if (plan && !PLANS.includes(plan)) {
    return res.status(400).json({ error: `Forfait invalide. Choix: ${PLANS.join(', ')}` });
  }

  try {
    const result = await pool.query(
      `UPDATE businesses SET
       subscription_status = COALESCE($1, subscription_status),
       trial_ends_at = COALESCE($2, trial_ends_at),
       plan = COALESCE($4, plan),
       payment_failed_at = CASE WHEN $1 = 'active' THEN NULL ELSE payment_failed_at END,
       updated_at = NOW()
       WHERE id = $3 RETURNING id, name, subscription_status, trial_ends_at, payment_failed_at, plan`,
      [subscriptionStatus || null, trialEndsAt || null, req.params.id, plan || null]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Commerce non trouvé' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Override subscription error:', err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour' });
  }
});

export default router;
