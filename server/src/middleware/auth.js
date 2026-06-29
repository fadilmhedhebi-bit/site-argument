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
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Session expirée, veuillez vous reconnecter', code: 'TOKEN_EXPIRED' });
    }
    res.status(401).json({ error: 'Token invalide', code: 'TOKEN_INVALID' });
  }
}

export function authenticateOptional(req, _res, next) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      req.user = jwt.verify(header.slice(7), JWT_SECRET);
    } catch {
      req.user = null;
    }
  }
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentification requise' });
    }
    if (!roles.some(r => req.user.role === r || req.user.role === 'manager_driver')) {
      return res.status(403).json({ error: 'Accès non autorisé pour ce rôle' });
    }
    next();
  };
}

export function verifySocketToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}
