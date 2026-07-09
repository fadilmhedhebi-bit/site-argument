import { Router } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import pool from '../config/db.js';
import { generateToken, authenticate, requireRole } from '../middleware/auth.js';
import { sendVerificationEmail, sendPasswordResetEmail } from '../utils/email.js';
import { PLANS, DEFAULT_PLAN, teamLimitFor } from '../config/plans.js';

async function assertTeamSlotAvailable(businessId) {
  const biz = await pool.query('SELECT plan FROM businesses WHERE id = $1', [businessId]);
  const limit = teamLimitFor(biz.rows[0]?.plan);
  const count = await pool.query(
    "SELECT COUNT(*) FROM users WHERE business_id = $1 AND role IN ('driver', 'staff')",
    [businessId]
  );
  if (parseInt(count.rows[0].count, 10) >= limit) {
    const err = new Error('Limite de comptes atteinte pour votre forfait. Passez à un forfait supérieur pour en ajouter.');
    err.code = 'TEAM_LIMIT_REACHED';
    throw err;
  }
}

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SMTP_CONFIGURED = !!process.env.BREVO_API_KEY;

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads/avatars'),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Format image invalide'));
  },
});

const logoStorage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads/logos'),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});
const uploadLogo = multer({
  storage: logoStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Format image invalide'));
  },
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { businessName, businessAddress, businessPhone, firstName, lastName, email, phone, username, password, plan } = req.body;
  const chosenPlan = PLANS.includes(plan) ? plan : DEFAULT_PLAN;

  if (!businessName?.trim()) {
    return res.status(400).json({ error: 'Le nom du commerce est requis' });
  }
  if (!firstName?.trim() || !lastName?.trim()) {
    return res.status(400).json({ error: 'Prénom et nom sont requis' });
  }
  if (!username?.trim() || username.length < 3) {
    return res.status(400).json({ error: "Le nom d'utilisateur doit faire au moins 3 caractères" });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Le mot de passe doit faire au moins 6 caractères' });
  }
  if (!email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "L'email est requis et doit être valide" });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query('SELECT id FROM users WHERE username = $1', [username.trim()]);
    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: "Ce nom d'utilisateur est déjà pris" });
    }

    const bizResult = await client.query(
      'INSERT INTO businesses (name, address, phone, plan) VALUES ($1, $2, $3, $4) RETURNING id',
      [businessName.trim(), businessAddress?.trim() || null, businessPhone?.trim() || null, chosenPlan]
    );
    const businessId = bizResult.rows[0].id;

    const passwordHash = await bcrypt.hash(password, 12);
    const autoVerify = !SMTP_CONFIGURED;
    const verificationToken = autoVerify ? null : crypto.randomBytes(32).toString('hex');
    const verificationExpires = autoVerify ? null : new Date(Date.now() + 24 * 60 * 60 * 1000);

    const userResult = await client.query(
      `INSERT INTO users (business_id, username, password_hash, first_name, last_name, email, phone, role, email_verified, verification_token, verification_expires)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'manager', $8, $9, $10) RETURNING id, role, business_id`,
      [businessId, username.trim(), passwordHash, firstName.trim(), lastName.trim(), email.trim(), phone?.trim() || null, autoVerify, verificationToken, verificationExpires]
    );

    await client.query('COMMIT');

    if (autoVerify) {
      const u = userResult.rows[0];
      return res.status(201).json({
        message: 'Compte créé avec succès !',
        token: generateToken(u),
        user: {
          id: u.id, username: username.trim(), firstName: firstName.trim(), lastName: lastName.trim(),
          email: email.trim(), role: u.role, businessId: u.business_id,
          businessName: businessName.trim(), businessAddress: businessAddress?.trim() || null,
          businessPhone: businessPhone?.trim() || null, plan: chosenPlan,
        },
      });
    }

    sendVerificationEmail(email.trim(), verificationToken, firstName.trim()).catch(err => {
      console.error('Failed to send verification email:', err);
    });

    res.status(201).json({
      message: 'Compte créé ! Vérifiez votre email pour activer votre compte.',
      needsVerification: true,
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Registration error:', err);
    res.status(500).json({ error: "Erreur interne lors de l'inscription" });
  } finally {
    client.release();
  }
});

// GET /api/auth/verify-email/:token
router.get('/verify-email/:token', async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE users SET email_verified = true, verification_token = NULL, verification_expires = NULL, updated_at = NOW()
       WHERE verification_token = $1 AND verification_expires > NOW()
       RETURNING id, role, business_id, username, first_name, last_name, email`,
      [req.params.token]
    );
    if (!result.rows.length) {
      return res.status(400).json({ error: 'Lien invalide ou expiré' });
    }
    const u = result.rows[0];
    const bizResult = await pool.query('SELECT name, address, phone, plan FROM businesses WHERE id = $1', [u.business_id]);
    const biz = bizResult.rows[0] || {};

    res.json({
      message: 'Email vérifié avec succès !',
      token: generateToken(u),
      user: {
        id: u.id, username: u.username, firstName: u.first_name, lastName: u.last_name,
        role: u.role, businessId: u.business_id, businessName: biz.name,
        businessAddress: biz.address, businessPhone: biz.phone, plan: biz.plan,
      },
    });
  } catch (err) {
    console.error('Verify email error:', err);
    res.status(500).json({ error: 'Erreur lors de la vérification' });
  }
});

// POST /api/auth/resend-verification
router.post('/resend-verification', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email requis' });

  try {
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const result = await pool.query(
      `UPDATE users SET verification_token = $1, verification_expires = $2
       WHERE email = $3 AND email_verified = false
       RETURNING first_name`,
      [verificationToken, verificationExpires, email.trim().toLowerCase()]
    );
    if (result.rows.length) {
      sendVerificationEmail(email.trim(), verificationToken, result.rows[0].first_name).catch(console.error);
    }
    res.json({ message: 'Si un compte existe avec cet email, un lien de vérification a été envoyé.' });
  } catch (err) {
    console.error('Resend verification error:', err);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email requis' });

  try {
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000);

    const result = await pool.query(
      `UPDATE users SET reset_token = $1, reset_expires = $2
       WHERE email = $3 AND is_active = true
       RETURNING first_name`,
      [resetToken, resetExpires, email.trim().toLowerCase()]
    );
    if (result.rows.length) {
      sendPasswordResetEmail(email.trim(), resetToken, result.rows[0].first_name).catch(console.error);
    }
    res.json({ message: 'Si un compte existe avec cet email, un lien de réinitialisation a été envoyé.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: 'Token et mot de passe requis' });
  if (password.length < 6) return res.status(400).json({ error: 'Le mot de passe doit faire au moins 6 caractères' });

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `UPDATE users SET password_hash = $1, reset_token = NULL, reset_expires = NULL, updated_at = NOW()
       WHERE reset_token = $2 AND reset_expires > NOW()
       RETURNING id`,
      [passwordHash, token]
    );
    if (!result.rows.length) {
      return res.status(400).json({ error: 'Lien invalide ou expiré' });
    }
    res.json({ message: 'Mot de passe réinitialisé avec succès' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Nom d'utilisateur et mot de passe requis" });
  }

  try {
    const result = await pool.query(
      `SELECT u.id, u.business_id, u.username, u.password_hash, u.first_name, u.last_name,
              u.email, u.role, u.is_active, u.email_verified, u.avatar_url,
              b.name as business_name, b.address as business_address, b.phone as business_phone, b.plan
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

    if (SMTP_CONFIGURED && !user.email_verified && user.email) {
      return res.status(403).json({
        error: 'Veuillez vérifier votre adresse email avant de vous connecter',
        code: 'EMAIL_NOT_VERIFIED',
        email: user.email,
      });
    }

    await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    res.json({
      token: generateToken(user),
      user: {
        id: user.id, username: user.username, firstName: user.first_name, lastName: user.last_name,
        email: user.email, role: user.role, businessId: user.business_id, avatarUrl: user.avatar_url,
        businessName: user.business_name, businessAddress: user.business_address, businessPhone: user.business_phone,
        plan: user.plan,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Erreur interne lors de la connexion' });
  }
});

// PATCH /api/auth/profile - Update profile (name, email)
router.patch('/profile', authenticate, async (req, res) => {
  const { firstName, lastName } = req.body;
  if (!firstName?.trim() || !lastName?.trim()) {
    return res.status(400).json({ error: 'Prénom et nom sont requis' });
  }

  try {
    const result = await pool.query(
      `UPDATE users SET first_name = $1, last_name = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING id, username, first_name, last_name, email, role, business_id, avatar_url`,
      [firstName.trim(), lastName.trim(), req.user.id]
    );
    const u = result.rows[0];
    const biz = await pool.query('SELECT name, address, phone FROM businesses WHERE id = $1', [u.business_id]);
    const b = biz.rows[0] || {};

    res.json({
      id: u.id, username: u.username, firstName: u.first_name, lastName: u.last_name,
      email: u.email, role: u.role, businessId: u.business_id, avatarUrl: u.avatar_url,
      businessName: b.name, businessAddress: b.address, businessPhone: b.phone,
    });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du profil' });
  }
});

// PATCH /api/auth/password - Change password
router.patch('/password', authenticate, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Mot de passe actuel et nouveau requis' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'Le nouveau mot de passe doit faire au moins 6 caractères' });

  try {
    const result = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Utilisateur non trouvé' });

    const valid = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: 'Mot de passe actuel incorrect' });

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [passwordHash, req.user.id]);

    res.json({ message: 'Mot de passe modifié avec succès' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Erreur lors du changement de mot de passe' });
  }
});

// POST /api/auth/avatar - Upload profile photo
router.post('/avatar', authenticate, (req, res) => {
  upload.single('avatar')(req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'Image trop volumineuse (max 2 Mo)' });
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) return res.status(400).json({ error: 'Aucune image envoyée' });

    try {
      const avatarUrl = `/uploads/avatars/${req.file.filename}`;
      await pool.query('UPDATE users SET avatar_url = $1, updated_at = NOW() WHERE id = $2', [avatarUrl, req.user.id]);
      res.json({ avatarUrl });
    } catch (error) {
      console.error('Avatar upload error:', error);
      res.status(500).json({ error: "Erreur lors de l'upload" });
    }
  });
});

// POST /api/auth/create-driver
router.post('/create-driver', authenticate, requireRole('manager'), async (req, res) => {
  const { firstName, lastName, phone, email } = req.body;

  if (!firstName?.trim() || !lastName?.trim()) {
    return res.status(400).json({ error: 'Prénom et nom du livreur sont requis' });
  }

  try {
    await assertTeamSlotAvailable(req.user.businessId);

    const baseUsername = `${firstName.toLowerCase().replace(/[^a-z]/g, '')}.${lastName.toLowerCase().replace(/[^a-z]/g, '')}`;
    const suffix = crypto.randomBytes(3).toString('hex');
    const username = `${baseUsername}.${suffix}`;

    const plainPassword = crypto.randomBytes(4).toString('hex');
    const passwordHash = await bcrypt.hash(plainPassword, 12);

    const result = await pool.query(
      `INSERT INTO users (business_id, username, password_hash, first_name, last_name, phone, email, role, email_verified)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'driver', true) RETURNING id, created_at`,
      [req.user.businessId, username, passwordHash, firstName.trim(), lastName.trim(), phone?.trim() || null, email?.trim() || null]
    );

    res.status(201).json({
      id: result.rows[0].id, username, password: plainPassword,
      firstName: firstName.trim(), lastName: lastName.trim(), phone: phone?.trim() || null,
      createdAt: result.rows[0].created_at,
      message: 'Communiquez ces identifiants au livreur. Le mot de passe ne pourra plus être affiché.',
    });
  } catch (err) {
    if (err.code === 'TEAM_LIMIT_REACHED') return res.status(403).json({ error: err.message, code: err.code });
    console.error('Create driver error:', err);
    if (err.code === '23505') return res.status(409).json({ error: 'Erreur de conflit, veuillez réessayer' });
    res.status(500).json({ error: 'Erreur interne lors de la création du livreur' });
  }
});

// Backward compat alias
router.post('/drivers', authenticate, requireRole('manager'), async (req, res, next) => {
  req.url = '/create-driver';
  router.handle(req, res, next);
});

// GET /api/auth/team-status - places utilisees / limite du forfait (livreurs + equipiers)
router.get('/team-status', authenticate, requireRole('manager'), async (req, res) => {
  try {
    const biz = await pool.query('SELECT plan FROM businesses WHERE id = $1', [req.user.businessId]);
    const plan = biz.rows[0]?.plan;
    const limit = teamLimitFor(plan);
    const count = await pool.query(
      "SELECT COUNT(*) FROM users WHERE business_id = $1 AND role IN ('driver', 'staff')",
      [req.user.businessId]
    );
    res.json({ plan, used: parseInt(count.rows[0].count, 10), limit: Number.isFinite(limit) ? limit : null });
  } catch (err) {
    console.error('Team status error:', err);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

// POST /api/auth/create-staff - equipier a acces restreint (caisse, commandes, reservations)
router.post('/create-staff', authenticate, requireRole('manager'), async (req, res) => {
  const { firstName, lastName, phone, email } = req.body;

  if (!firstName?.trim() || !lastName?.trim()) {
    return res.status(400).json({ error: 'Prénom et nom sont requis' });
  }

  try {
    await assertTeamSlotAvailable(req.user.businessId);

    const baseUsername = `${firstName.toLowerCase().replace(/[^a-z]/g, '')}.${lastName.toLowerCase().replace(/[^a-z]/g, '')}`;
    const suffix = crypto.randomBytes(3).toString('hex');
    const username = `${baseUsername}.${suffix}`;

    const plainPassword = crypto.randomBytes(4).toString('hex');
    const passwordHash = await bcrypt.hash(plainPassword, 12);

    const result = await pool.query(
      `INSERT INTO users (business_id, username, password_hash, first_name, last_name, phone, email, role, email_verified)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'staff', true) RETURNING id, created_at`,
      [req.user.businessId, username, passwordHash, firstName.trim(), lastName.trim(), phone?.trim() || null, email?.trim() || null]
    );

    res.status(201).json({
      id: result.rows[0].id, username, password: plainPassword,
      firstName: firstName.trim(), lastName: lastName.trim(), phone: phone?.trim() || null,
      createdAt: result.rows[0].created_at,
      message: 'Communiquez ces identifiants à l\'équipier. Le mot de passe ne pourra plus être affiché.',
    });
  } catch (err) {
    if (err.code === 'TEAM_LIMIT_REACHED') return res.status(403).json({ error: err.message, code: err.code });
    console.error('Create staff error:', err);
    if (err.code === '23505') return res.status(409).json({ error: 'Erreur de conflit, veuillez réessayer' });
    res.status(500).json({ error: "Erreur interne lors de la création de l'équipier" });
  }
});

// GET /api/auth/staff
router.get('/staff', authenticate, requireRole('manager'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, username, first_name, last_name, phone, email, role, is_active, last_login, created_at
       FROM users WHERE business_id = $1 AND role = 'staff' ORDER BY created_at DESC`,
      [req.user.businessId]
    );
    res.json(result.rows.map(u => ({
      id: u.id, username: u.username, firstName: u.first_name, lastName: u.last_name,
      phone: u.phone, email: u.email, role: u.role, isActive: u.is_active,
      lastLogin: u.last_login, createdAt: u.created_at,
    })));
  } catch (err) {
    console.error('List staff error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des équipiers' });
  }
});

// PATCH /api/auth/staff/:id/toggle
router.patch('/staff/:id/toggle', authenticate, requireRole('manager'), async (req, res) => {
  try {
    const staff = await pool.query(
      "SELECT id, is_active FROM users WHERE id = $1 AND business_id = $2 AND role = 'staff'",
      [req.params.id, req.user.businessId]
    );
    if (!staff.rows.length) return res.status(404).json({ error: 'Équipier non trouvé' });

    const newStatus = !staff.rows[0].is_active;
    await pool.query('UPDATE users SET is_active = $1, updated_at = NOW() WHERE id = $2', [newStatus, req.params.id]);
    res.json({ id: req.params.id, isActive: newStatus });
  } catch (err) {
    console.error('Toggle staff error:', err);
    res.status(500).json({ error: 'Erreur lors de la modification du statut' });
  }
});

// PATCH /api/auth/staff/:id/reset-password
router.patch('/staff/:id/reset-password', authenticate, requireRole('manager'), async (req, res) => {
  try {
    const staff = await pool.query(
      "SELECT id, first_name, last_name, username FROM users WHERE id = $1 AND business_id = $2 AND role = 'staff'",
      [req.params.id, req.user.businessId]
    );
    if (!staff.rows.length) return res.status(404).json({ error: 'Équipier non trouvé' });

    const plainPassword = crypto.randomBytes(4).toString('hex');
    const passwordHash = await bcrypt.hash(plainPassword, 12);
    await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [passwordHash, req.params.id]);

    const s = staff.rows[0];
    res.json({
      id: s.id, username: s.username, password: plainPassword,
      firstName: s.first_name, lastName: s.last_name,
      message: 'Nouveau mot de passe généré. Communiquez-le à l\'équipier.',
    });
  } catch (err) {
    console.error('Reset staff password error:', err);
    res.status(500).json({ error: 'Erreur lors de la réinitialisation du mot de passe' });
  }
});

// DELETE /api/auth/staff/:id
router.delete('/staff/:id', authenticate, requireRole('manager'), async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM users WHERE id = $1 AND business_id = $2 AND role = 'staff' RETURNING id",
      [req.params.id, req.user.businessId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Équipier non trouvé' });
    res.status(204).end();
  } catch (err) {
    console.error('Delete staff error:', err);
    res.status(500).json({ error: "Erreur lors de la suppression de l'équipier" });
  }
});

// DELETE /api/auth/drivers/:id
router.delete('/drivers/:id', authenticate, requireRole('manager'), async (req, res) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte' });
  }
  try {
    const result = await pool.query(
      "DELETE FROM users WHERE id = $1 AND business_id = $2 AND role IN ('driver', 'manager_driver') RETURNING id",
      [req.params.id, req.user.businessId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Livreur non trouvé' });
    res.status(204).end();
  } catch (err) {
    console.error('Delete driver error:', err);
    res.status(500).json({ error: 'Erreur lors de la suppression du livreur' });
  }
});

// GET /api/auth/business/delivery-fee
router.get('/business/delivery-fee', authenticate, requireRole('manager'), async (req, res) => {
  try {
    const result = await pool.query('SELECT delivery_fee FROM businesses WHERE id = $1', [req.user.businessId]);
    if (!result.rows.length) return res.status(404).json({ error: 'Commerce non trouvé' });
    res.json({ deliveryFee: parseFloat(result.rows[0].delivery_fee ?? 2.50) });
  } catch (err) {
    console.error('Get delivery fee error:', err);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

// PATCH /api/auth/business/delivery-fee
router.patch('/business/delivery-fee', authenticate, requireRole('manager'), async (req, res) => {
  const { deliveryFee } = req.body;
  if (deliveryFee == null || isNaN(deliveryFee) || parseFloat(deliveryFee) < 0) {
    return res.status(400).json({ error: 'Montant invalide (nombre >= 0)' });
  }
  try {
    await pool.query('UPDATE businesses SET delivery_fee = $1, updated_at = NOW() WHERE id = $2', [parseFloat(deliveryFee), req.user.businessId]);
    res.json({ deliveryFee: parseFloat(deliveryFee) });
  } catch (err) {
    console.error('Update delivery fee error:', err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour' });
  }
});

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

// GET /api/auth/business/branding - couleurs personnalisees (tous roles, pour appliquer le theme)
router.get('/business/branding', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT primary_color, secondary_color, logo_url FROM businesses WHERE id = $1',
      [req.user.businessId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Commerce non trouvé' });
    const b = result.rows[0];
    res.json({ primaryColor: b.primary_color, secondaryColor: b.secondary_color, logoUrl: b.logo_url });
  } catch (err) {
    console.error('Get branding error:', err);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

// PATCH /api/auth/business/branding
router.patch('/business/branding', authenticate, requireRole('manager'), async (req, res) => {
  const { primaryColor, secondaryColor } = req.body;
  if (primaryColor != null && !HEX_COLOR_RE.test(primaryColor)) {
    return res.status(400).json({ error: 'Couleur primaire invalide (format hex #RRGGBB)' });
  }
  if (secondaryColor != null && !HEX_COLOR_RE.test(secondaryColor)) {
    return res.status(400).json({ error: 'Couleur secondaire invalide (format hex #RRGGBB)' });
  }
  try {
    await pool.query(
      'UPDATE businesses SET primary_color = $1, secondary_color = $2, updated_at = NOW() WHERE id = $3',
      [primaryColor || null, secondaryColor || null, req.user.businessId]
    );
    res.json({ primaryColor: primaryColor || null, secondaryColor: secondaryColor || null });
  } catch (err) {
    console.error('Update branding error:', err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour' });
  }
});

// POST /api/auth/business/logo - Upload du logo du commerce, affiche aux
// clients finaux sur les pages de commande/suivi/reservation (a la place du
// symbole RestoLab generique).
router.post('/business/logo', authenticate, requireRole('manager'), (req, res) => {
  uploadLogo.single('logo')(req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'Image trop volumineuse (max 2 Mo)' });
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) return res.status(400).json({ error: 'Aucune image envoyée' });

    try {
      const logoUrl = `/uploads/logos/${req.file.filename}`;
      await pool.query('UPDATE businesses SET logo_url = $1, updated_at = NOW() WHERE id = $2', [logoUrl, req.user.businessId]);
      res.json({ logoUrl });
    } catch (error) {
      console.error('Logo upload error:', error);
      res.status(500).json({ error: "Erreur lors de l'upload" });
    }
  });
});

const IP_RE = /^(\d{1,3}\.){3}\d{1,3}$/;

// GET /api/auth/business/printers - adresses IP des imprimantes cuisine/recu
router.get('/business/printers', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT kitchen_printer_ip, receipt_printer_ip FROM businesses WHERE id = $1',
      [req.user.businessId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Commerce non trouvé' });
    const b = result.rows[0];
    res.json({ kitchenPrinterIp: b.kitchen_printer_ip, receiptPrinterIp: b.receipt_printer_ip });
  } catch (err) {
    console.error('Get printers error:', err);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

// PATCH /api/auth/business/printers
router.patch('/business/printers', authenticate, requireRole('manager'), async (req, res) => {
  const { kitchenPrinterIp, receiptPrinterIp } = req.body;
  if (kitchenPrinterIp && !IP_RE.test(kitchenPrinterIp)) {
    return res.status(400).json({ error: 'Adresse IP imprimante cuisine invalide' });
  }
  if (receiptPrinterIp && !IP_RE.test(receiptPrinterIp)) {
    return res.status(400).json({ error: 'Adresse IP imprimante reçu invalide' });
  }
  try {
    await pool.query(
      'UPDATE businesses SET kitchen_printer_ip = $1, receipt_printer_ip = $2, updated_at = NOW() WHERE id = $3',
      [kitchenPrinterIp || null, receiptPrinterIp || null, req.user.businessId]
    );
    res.json({ kitchenPrinterIp: kitchenPrinterIp || null, receiptPrinterIp: receiptPrinterIp || null });
  } catch (err) {
    console.error('Update printers error:', err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour' });
  }
});

// PATCH /api/auth/role
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

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.username, u.first_name, u.last_name, u.email, u.phone, u.role,
              u.business_id, u.is_active, u.last_login, u.created_at, u.avatar_url,
              b.name as business_name, b.address as business_address, b.phone as business_phone, b.plan
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
      businessPhone: u.business_phone, isActive: u.is_active, avatarUrl: u.avatar_url,
      lastLogin: u.last_login, createdAt: u.created_at, plan: u.plan,
    });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération du profil' });
  }
});

// GET /api/auth/drivers
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

// PATCH /api/auth/drivers/:id/toggle
router.patch('/drivers/:id/toggle', authenticate, requireRole('manager'), async (req, res) => {
  try {
    const driver = await pool.query(
      "SELECT id, is_active FROM users WHERE id = $1 AND business_id = $2 AND role IN ('driver', 'manager_driver')",
      [req.params.id, req.user.businessId]
    );
    if (!driver.rows.length) return res.status(404).json({ error: 'Livreur non trouvé' });

    const newStatus = !driver.rows[0].is_active;
    await pool.query('UPDATE users SET is_active = $1, updated_at = NOW() WHERE id = $2', [newStatus, req.params.id]);
    res.json({ id: req.params.id, isActive: newStatus });
  } catch (err) {
    console.error('Toggle driver error:', err);
    res.status(500).json({ error: 'Erreur lors de la modification du statut' });
  }
});

// PATCH /api/auth/drivers/:id/reset-password
router.patch('/drivers/:id/reset-password', authenticate, requireRole('manager'), async (req, res) => {
  try {
    const driver = await pool.query(
      "SELECT id, first_name, last_name, username FROM users WHERE id = $1 AND business_id = $2 AND role IN ('driver', 'manager_driver')",
      [req.params.id, req.user.businessId]
    );
    if (!driver.rows.length) return res.status(404).json({ error: 'Livreur non trouvé' });

    const plainPassword = crypto.randomBytes(4).toString('hex');
    const passwordHash = await bcrypt.hash(plainPassword, 12);
    await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [passwordHash, req.params.id]);

    const d = driver.rows[0];
    res.json({
      id: d.id, username: d.username, password: plainPassword,
      firstName: d.first_name, lastName: d.last_name,
      message: 'Nouveau mot de passe généré. Communiquez-le au livreur.',
    });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Erreur lors de la réinitialisation du mot de passe' });
  }
});

export default router;
