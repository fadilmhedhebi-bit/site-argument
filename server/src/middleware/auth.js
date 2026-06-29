import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

export function generateToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, businessId: user.business_id },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

export function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token manquant' });
  }
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token invalide' });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.some(r => req.user.role === r || req.user.role === 'manager_driver')) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }
    next();
  };
}
