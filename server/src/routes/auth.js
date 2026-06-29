import { Router } from 'express';
import bcrypt from 'bcrypt';
import pool from '../config/db.js';
import { generateToken, authenticate, requireRole } from '../middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

router.post('/register', async (req, res) => {
  const { businessName, businessAddress, businessPhone, firstName, lastName, email, phone, username, password } = req.body;
  if (!businessName || !firstName || !lastName || !username || !password) {
    return res.status(400).json({ error: 'Champs obligatoires manquants' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query('SELECT id FROM users WHERE username = $1', [username]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Ce nom d\'utilisateur est déjà pris' });
    }

    const bizResult = await client.query(
      'INSERT INTO businesses (name, address, phone) VALUES ($1, $2, $3) RETURNING id',
      [businessName, businessAddress || null, businessPhone || null]
    );
    const businessId = bizResult.rows[0].id;

    const passwordHash = await bcrypt.hash(password, 10);
    const userResult = await client.query(
      `INSERT INTO users (business_id, username, password_hash, first_name, last_name, email, phone, role)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'manager') RETURNING id, role`,
      [businessId, username, passwordHash, firstName, lastName, email || null, phone || null]
    );

    await client.query('COMMIT');

    const user = { id: userResult.rows[0].id, role: userResult.rows[0].role, business_id: businessId };
    res.status(201).json({
      token: generateToken(user),
      user: { id: user.id, username, firstName, lastName, role: user.role, businessId },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Erreur lors de l\'inscription' });
  } finally {
    client.release();
  }
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Identifiants requis' });
  }

  try {
    const result = await pool.query(
      'SELECT id, business_id, username, password_hash, first_name, last_name, role, is_active FROM users WHERE username = $1',
      [username]
    );
    const user = result.rows[0];
    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'Identifiants incorrects' });
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
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Erreur de connexion' });
  }
});

router.post('/drivers', authenticate, requireRole('manager'), async (req, res) => {
  const { firstName, lastName, phone } = req.body;
  if (!firstName || !lastName) {
    return res.status(400).json({ error: 'Prénom et nom requis' });
  }

  try {
    const username = `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${Math.random().toString(36).slice(2, 6)}`;
    const plainPassword = uuidv4().slice(0, 8);
    const passwordHash = await bcrypt.hash(plainPassword, 10);

    const result = await pool.query(
      `INSERT INTO users (business_id, username, password_hash, first_name, last_name, phone, role)
       VALUES ($1, $2, $3, $4, $5, $6, 'driver') RETURNING id`,
      [req.user.businessId, username, passwordHash, firstName, lastName, phone || null]
    );

    res.status(201).json({
      id: result.rows[0].id,
      username,
      password: plainPassword,
      firstName,
      lastName,
    });
  } catch (err) {
    console.error('Create driver error:', err);
    res.status(500).json({ error: 'Erreur lors de la création du livreur' });
  }
});

router.patch('/role', authenticate, requireRole('manager'), async (req, res) => {
  const { role } = req.body;
  if (!['manager', 'manager_driver'].includes(role)) {
    return res.status(400).json({ error: 'Rôle invalide' });
  }
  try {
    await pool.query('UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2', [role, req.user.id]);
    res.json({ role });
  } catch (err) {
    res.status(500).json({ error: 'Erreur' });
  }
});

router.get('/me', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT u.id, u.username, u.first_name, u.last_name, u.email, u.phone, u.role, u.business_id, b.name as business_name FROM users u JOIN businesses b ON b.id = u.business_id WHERE u.id = $1',
      [req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Utilisateur non trouvé' });
    const u = result.rows[0];
    res.json({
      id: u.id, username: u.username, firstName: u.first_name, lastName: u.last_name,
      email: u.email, phone: u.phone, role: u.role, businessId: u.business_id, businessName: u.business_name,
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur' });
  }
});

router.get('/drivers', authenticate, requireRole('manager'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, username, first_name, last_name, phone, role, is_active, last_login
       FROM users WHERE business_id = $1 AND role IN ('driver', 'manager_driver') ORDER BY created_at DESC`,
      [req.user.businessId]
    );
    res.json(result.rows.map(u => ({
      id: u.id, username: u.username, firstName: u.first_name, lastName: u.last_name,
      phone: u.phone, role: u.role, isActive: u.is_active, lastLogin: u.last_login,
    })));
  } catch (err) {
    res.status(500).json({ error: 'Erreur' });
  }
});

export default router;
