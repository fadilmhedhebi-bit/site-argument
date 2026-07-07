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

const READ_ONLY_MESSAGES = {
  trialing: "Période d'essai terminée. Démarrez votre abonnement pour effectuer cette action.",
  past_due: 'Échec de paiement : mettez à jour votre moyen de paiement pour effectuer cette action.',
  canceled: 'Abonnement résilié. Réabonnez-vous pour effectuer cette action.',
  suspended: 'Abonnement suspendu. Contactez-nous pour le réactiver.',
};

function decodeBusinessId(req) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(header.slice(7), JWT_SECRET).businessId || null;
  } catch {
    return null;
  }
}

// Politique : un commerce sans abonnement actif (essai termine, paiement en
// echec au-dela de la grace, resilie, suspendu) garde un acces en LECTURE
// SEULE a toute l'application - il voit ses donnees et modules normalement,
// mais toute action d'ecriture (POST/PUT/PATCH/DELETE) est bloquee avec un
// message clair plutot que de couper completement l'acces.
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

    if (biz.subscription_status === 'trialing' && new Date(biz.trial_ends_at) > new Date()) {
      return next();
    }

    if (biz.subscription_status === 'past_due') {
      const graceEnd = biz.payment_failed_at ? new Date(biz.payment_failed_at) : new Date();
      graceEnd.setDate(graceEnd.getDate() + GRACE_PERIOD_DAYS);
      if (new Date() < graceEnd) return next(); // grace : acces complet encore
    }

    if (!isWrite) return next();

    return res.status(402).json({
      error: READ_ONLY_MESSAGES[biz.subscription_status] || 'Abonnement inactif.',
      code: 'SUBSCRIPTION_READ_ONLY',
    });
  } catch (err) {
    console.error('Subscription check error:', err);
    // Un incident technique sur le gating ne doit jamais bloquer tout le
    // service : on laisse passer plutot que de fermer par defaut.
    return next();
  }
}
