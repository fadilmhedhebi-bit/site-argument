import jwt from 'jsonwebtoken';
import pool from '../config/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

// Duree de lecture-seule accordee apres un echec de prelevement avant
// blocage complet (voir businesses.payment_failed_at).
export const GRACE_PERIOD_DAYS = 7;

// Routes qui ne doivent jamais etre bloquees par un probleme de facturation :
// connexion (il faut pouvoir se connecter pour voir l'alerte), facturation
// elle-meme (sinon impossible de regulariser), admin plateforme, sante.
const EXEMPT_PREFIXES = ['/api/auth', '/api/billing', '/api/platform-admin', '/api/health'];

function decodeBusinessId(req) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(header.slice(7), JWT_SECRET).businessId || null;
  } catch {
    return null;
  }
}

export async function requireActiveSubscription(req, res, next) {
  if (EXEMPT_PREFIXES.some(p => req.path.startsWith(p))) return next();

  const businessId = decodeBusinessId(req);
  // Pas de token exploitable : rien a gater ici, le middleware authenticate()
  // de la route se chargera du 401 s'il en faut un.
  if (!businessId) return next();

  try {
    const result = await pool.query(
      'SELECT subscription_status, trial_ends_at, payment_failed_at FROM businesses WHERE id = $1',
      [businessId]
    );
    if (!result.rows.length) return next();

    const biz = result.rows[0];
    const isWrite = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);

    if (biz.subscription_status === 'active') return next();

    if (biz.subscription_status === 'trialing') {
      if (new Date(biz.trial_ends_at) > new Date()) return next();
      return res.status(402).json({
        error: 'Période d\'essai terminée. Démarrez votre abonnement pour continuer.',
        code: 'TRIAL_EXPIRED',
      });
    }

    if (biz.subscription_status === 'past_due') {
      const graceEnd = biz.payment_failed_at ? new Date(biz.payment_failed_at) : new Date();
      graceEnd.setDate(graceEnd.getDate() + GRACE_PERIOD_DAYS);

      if (new Date() < graceEnd) {
        if (!isWrite) return next();
        return res.status(402).json({
          error: 'Échec de paiement : mettez à jour votre moyen de paiement (accès en lecture seule pendant la période de grâce).',
          code: 'PAYMENT_GRACE',
        });
      }
      return res.status(402).json({
        error: 'Abonnement suspendu pour défaut de paiement.',
        code: 'PAYMENT_OVERDUE',
      });
    }

    // canceled / suspended
    return res.status(402).json({
      error: 'Abonnement inactif. Contactez-nous pour le réactiver.',
      code: 'SUBSCRIPTION_INACTIVE',
    });
  } catch (err) {
    console.error('Subscription check error:', err);
    // Un incident technique sur le gating ne doit jamais bloquer tout le
    // service : on laisse passer plutot que de fermer par defaut.
    return next();
  }
}
