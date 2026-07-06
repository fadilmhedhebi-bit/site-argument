import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

// Token distinct de celui des comptes "users" (managers/livreurs) : pas de
// business_id, marque isPlatformAdmin pour ne jamais pouvoir etre confondu
// avec un compte scope a un seul commerce.
export function generatePlatformToken(admin) {
  return jwt.sign({ id: admin.id, isPlatformAdmin: true }, JWT_SECRET, { expiresIn: '12h' });
}

export function authenticatePlatform(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token manquant' });
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET);
    if (!payload.isPlatformAdmin) {
      return res.status(403).json({ error: 'Accès réservé aux administrateurs RestoLab' });
    }
    req.admin = payload;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Session expirée, veuillez vous reconnecter', code: 'TOKEN_EXPIRED' });
    }
    res.status(401).json({ error: 'Token invalide', code: 'TOKEN_INVALID' });
  }
}
