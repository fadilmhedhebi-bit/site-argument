import { Router } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import pool from '../config/db.js';
import { generateToken, authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

// POST /api/auth/register - Inscription gestionnaire + commerce
router.post('/register', async (req, res) => {
  const { businessName, businessAddress, businessPhone, firstName, lastName, email, phone, username, password } = req.body;

  if (!businessName?.trim()) {
    return res.status(400).json({ error: 'Le nom du commerce est requis' });
  }
  if (!firstName?.trim() || !lastName?.trim()) {
    return res.status(400).json({ error: 'Prénom et nom sont requis' });
  }
  if (!username?.trim() || username.length < 3) {
    return res.status(400).json({ error: 'Le nom d\'utilisateur doit faire au moins 3 caractères' });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Le mot de passe doit faire au moins 6 caractères' });
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Format d\'email invalide' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query('SELECT id FROM users WHERE username = $1', [username.trim()]);
    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Ce nom d\'utilisateur est déjà pris' });
    }

    const bizResult = await client.query(
      'INSERT INTO businesses (name, address, phone) VALUES ($1, $2, $3) RETURNING id',
      [businessName.trim(), businessAddress?.trim() || null, businessPhone?.trim() || null]
    );
    const businessId = bizResult.rows[0].id;

    const passwordHash = await bcrypt.hash(password, 12);
    const userResult = await client.query(
      `INSERT INTO users (business_id, username, password_hash, first_name, last_name, email, phone, role)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'manager') RETURNING id, role`,
      [businessId, username.trim(), passwordHash, firstName.trim(), lastName.trim(), email?.trim() || null, phone?.trim() || null]
    );

    await client.query('COMMIT');

    const user = { id: userResult.rows[0].id, role: userResult.rows[0].role, business_id: businessId };
    res.status(201).json({
      token: generateToken(user),
      user: {
        id: user.id,
        username: username.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        role: user.role,
        businessId,
        businessName: businessName.trim(),
        businessAddress: businessAddress?.trim() || null,
        businessPhone: businessPhone?.trim() || null,
      },
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Erreur interne lors de l\'inscription' });
  } finally {
    client.release();
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Nom d\'utilisateur et mot de passe requis' });
  }

  try {
    const result = await pool.query(
      `SELECT u.id, u.business_id, u.username, u.password_hash, u.first_name, u.last_name,
              u.role, u.is_active, b.name as business_name, b.address as business_address,
              b.phone as business_phone
       FROM users u JOIN businesses b ON b.id = u.business_id
       WHERE u.username = $1`,
      [username.trim()]
    );
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Identifiants incorrects' });
    }
    if (!user.is_active) {
      return res.status(403).json({ error: 'Compte désactivé, contactez votre gestionnaire' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Identifiants incorrects' });
    }

    await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    res.json({
      token: generateToken(user),
      user: {
        id: user.id,
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        businessId: user.business_id,
        businessName: user.business_name,
        businessAddress: user.business_address,
        businessPhone: user.business_phone,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Erreur interne lors de la connexion' });
  }
});

// POST /api/auth/create-driver - Création livreur avec identifiants auto-générés
router.post('/create-driver', authenticate, requireRole('manager'), async (req, res) => {
  const { firstName, lastName, phone, email } = req.body;

  if (!firstName?.trim() || !lastName?.trim()) {
    return res.status(400).json({ error: 'Prénom et nom du livreur sont requis' });
  }

  try {
    const baseUsername = `${firstName.toLowerCase().replace(/[^a-z]/g, '')}.${lastName.toLowerCase().replace(/[^a-z]/g, '')}`;
    const suffix = crypto.randomBytes(3).toString('hex');
    const username = `${baseUsername}.${suffix}`;

    const plainPassword = crypto.randomBytes(4).toString('hex');
    const passwordHash = await bcrypt.hash(plainPassword, 12);

    const result = await pool.query(
      `INSERT INTO users (business_id, username, password_hash, first_name, last_name, phone, email, role)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'driver') RETURNING id, created_at`,
      [req.user.businessId, username, passwordHash, firstName.trim(), lastName.trim(), phone?.trim() || null, email?.trim() || null]
    );

    res.status(201).json({
      id: result.rows[0].id,
      username,
      password: plainPassword,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: phone?.trim() || null,
      createdAt: result.rows[0].created_at,
      message: 'Communiquez ces identifiants au livreur. Le mot de passe ne pourra plus être affiché.',
    });
  } catch (err) {
    console.error('Create driver error:', err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Erreur de conflit, veuillez réessayer' });
    }
    res.status(500).json({ error: 'Erreur interne lors de la création du livreur' });
  }
});

// Backward compat alias
router.post('/drivers', authenticate, requireRole('manager'), async (req, res, next) => {
  req.url = '/create-driver';
  router.handle(req, res, next);
});

// PATCH /api/auth/role - Basculer manager <-> manager_driver
router.patch('/role', authenticate, requireRole('manager'), async (req, res) => {
  const { role } = req.body;
  if (!['manager', 'manager_driver'].includes(role)) {
    return res.status(400).json({ error: 'Rôle invalide. Choix: manager, manager_driver' });
  }
  try {
    await pool.query('UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2', [role, req.user.id]);
    const updated = await pool.query(
      `SELECT u.id, u.username, u.first_name, u.last_name, u.role, u.business_id, b.name as business_name
       FROM users u JOIN businesses b ON b.id = u.business_id WHERE u.id = $1`,
      [req.user.id]
    );
    const u = updated.rows[0];
    res.json({
      token: generateToken({ id: u.id, role: u.role, business_id: u.business_id }),
      user: {
        id: u.id, username: u.username, firstName: u.first_name, lastName: u.last_name,
        role: u.role, businessId: u.business_id, businessName: u.business_name,
      },
    });
  } catch (err) {
    console.error('Role update error:', err);
    res.status(500).json({ error: 'Erreur lors du changement de rôle' });
  }
});

// GET /api/auth/me - Profil utilisateur courant
router.get('/me', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.username, u.first_name, u.last_name, u.email, u.phone, u.role,
              u.business_id, u.is_active, u.last_login, u.created_at,
              b.name as business_name, b.address as business_address, b.phone as business_phone
       FROM users u JOIN businesses b ON b.id = u.business_id WHERE u.id = $1`,
      [req.user.id]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    const u = result.rows[0];
    res.json({
      id: u.id, username: u.username, firstName: u.first_name, lastName: u.last_name,
      email: u.email, phone: u.phone, role: u.role, businessId: u.business_id,
      businessName: u.business_name, businessAddress: u.business_address,
      businessPhone: u.business_phone, isActive: u.is_active,
      lastLogin: u.last_login, createdAt: u.created_at,
    });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération du profil' });
  }
});

// GET /api/auth/drivers - Liste des livreurs du commerce
router.get('/drivers', authenticate, requireRole('manager'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, username, first_name, last_name, phone, email, role, is_active, last_login, created_at
       FROM users WHERE business_id = $1 AND role IN ('driver', 'manager_driver') ORDER BY created_at DESC`,
      [req.user.businessId]
    );
    res.json(result.rows.map(u => ({
      id: u.id, username: u.username, firstName: u.first_name, lastName: u.last_name,
      phone: u.phone, email: u.email, role: u.role, isActive: u.is_active,
      lastLogin: u.last_login, createdAt: u.created_at,
    })));
  } catch (err) {
    console.error('List drivers error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des livreurs' });
  }
});

// PATCH /api/auth/drivers/:id/toggle - Activer/désactiver un livreur
router.patch('/drivers/:id/toggle', authenticate, requireRole('manager'), async (req, res) => {
  try {
    const driver = await pool.query(
      'SELECT id, is_active FROM users WHERE id = $1 AND business_id = $2 AND role IN (\'driver\', \'manager_driver\')',
      [req.params.id, req.user.businessId]
    );
    if (!driver.rows.length) {
      return res.status(404).json({ error: 'Livreur non trouvé' });
    }

    const newStatus = !driver.rows[0].is_active;
    await pool.query('UPDATE users SET is_active = $1, updated_at = NOW() WHERE id = $2', [newStatus, req.params.id]);
    res.json({ id: req.params.id, isActive: newStatus });
  } catch (err) {
    console.error('Toggle driver error:', err);
    res.status(500).json({ error: 'Erreur lors de la modification du statut' });
  }
});

// PATCH /api/auth/drivers/:id/reset-password - Réinitialiser mot de passe livreur
router.patch('/drivers/:id/reset-password', authenticate, requireRole('manager'), async (req, res) => {
  try {
    const driver = await pool.query(
      'SELECT id, first_name, last_name, username FROM users WHERE id = $1 AND business_id = $2 AND role IN (\'driver\', \'manager_driver\')',
      [req.params.id, req.user.businessId]
    );
    if (!driver.rows.length) {
      return res.status(404).json({ error: 'Livreur non trouvé' });
    }

    const plainPassword = crypto.randomBytes(4).toString('hex');
    const passwordHash = await bcrypt.hash(plainPassword, 12);
    await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [passwordHash, req.params.id]);

    const d = driver.rows[0];
    res.json({
      id: d.id,
      username: d.username,
      password: plainPassword,
      firstName: d.first_name,
      lastName: d.last_name,
      message: 'Nouveau mot de passe généré. Communiquez-le au livreur.',
    });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Erreur lors de la réinitialisation du mot de passe' });
  }
});

export default router;
