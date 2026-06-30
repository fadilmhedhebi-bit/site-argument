import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../config/db.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

function generateCustomerToken(customer) {
  return jwt.sign(
    { id: customer.id, role: 'customer', businessId: customer.business_id },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

function authenticateCustomer(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token manquant' });
  }
  try {
    const decoded = jwt.verify(header.slice(7), JWT_SECRET);
    if (decoded.role !== 'customer') {
      return res.status(403).json({ error: 'Accès réservé aux clients' });
    }
    req.customer = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Token invalide' });
  }
}

// ============================================================
// CUSTOMER AUTH (public)
// ============================================================

router.post('/register', async (req, res) => {
  const { businessId, email, password, firstName, lastName, phone } = req.body;

  if (!businessId || !UUID_RE.test(businessId)) return res.status(400).json({ error: 'businessId requis' });
  if (!email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Email invalide' });
  if (!password || password.length < 6) return res.status(400).json({ error: 'Mot de passe: 6 caractères minimum' });
  if (!firstName?.trim() || !lastName?.trim()) return res.status(400).json({ error: 'Prénom et nom requis' });

  try {
    const biz = await pool.query('SELECT id, name FROM businesses WHERE id = $1', [businessId]);
    if (!biz.rows.length) return res.status(404).json({ error: 'Restaurant non trouvé' });

    const existing = await pool.query(
      'SELECT id FROM customers WHERE business_id = $1 AND email = $2',
      [businessId, email.trim().toLowerCase()]
    );
    if (existing.rows.length) return res.status(409).json({ error: 'Un compte existe déjà avec cet email' });

    const passwordHash = await bcrypt.hash(password, 12);

    const loyaltyConfig = await pool.query(
      'SELECT welcome_points FROM loyalty_config WHERE business_id = $1 AND is_active = true',
      [businessId]
    );
    const welcomePoints = loyaltyConfig.rows[0]?.welcome_points || 0;

    const result = await pool.query(
      `INSERT INTO customers (business_id, email, password_hash, first_name, last_name, phone, loyalty_points)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, business_id, email, first_name, last_name, phone, loyalty_points, created_at`,
      [businessId, email.trim().toLowerCase(), passwordHash, firstName.trim(), lastName.trim(), phone?.trim() || null, welcomePoints]
    );

    const customer = result.rows[0];

    if (welcomePoints > 0) {
      await pool.query(
        `INSERT INTO loyalty_transactions (customer_id, type, points, description) VALUES ($1, 'bonus', $2, 'Points de bienvenue')`,
        [customer.id, welcomePoints]
      );
    }

    res.status(201).json({
      token: generateCustomerToken(customer),
      customer: {
        id: customer.id, email: customer.email, firstName: customer.first_name,
        lastName: customer.last_name, phone: customer.phone,
        loyaltyPoints: customer.loyalty_points, businessId: customer.business_id,
        businessName: biz.rows[0].name,
      },
    });
  } catch (err) {
    console.error('Customer register error:', err);
    res.status(500).json({ error: 'Erreur lors de l\'inscription' });
  }
});

router.post('/login', async (req, res) => {
  const { businessId, email, password } = req.body;

  if (!businessId || !UUID_RE.test(businessId)) return res.status(400).json({ error: 'businessId requis' });
  if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis' });

  try {
    const result = await pool.query(
      `SELECT c.*, b.name as business_name FROM customers c
       JOIN businesses b ON b.id = c.business_id
       WHERE c.business_id = $1 AND c.email = $2`,
      [businessId, email.trim().toLowerCase()]
    );

    if (!result.rows.length) return res.status(401).json({ error: 'Identifiants incorrects' });

    const customer = result.rows[0];
    if (!customer.is_active) return res.status(403).json({ error: 'Compte désactivé' });

    const valid = await bcrypt.compare(password, customer.password_hash);
    if (!valid) return res.status(401).json({ error: 'Identifiants incorrects' });

    res.json({
      token: generateCustomerToken(customer),
      customer: {
        id: customer.id, email: customer.email, firstName: customer.first_name,
        lastName: customer.last_name, phone: customer.phone,
        loyaltyPoints: customer.loyalty_points, totalOrders: customer.total_orders,
        totalSpent: parseFloat(customer.total_spent), businessId: customer.business_id,
        businessName: customer.business_name,
      },
    });
  } catch (err) {
    console.error('Customer login error:', err);
    res.status(500).json({ error: 'Erreur lors de la connexion' });
  }
});

// ============================================================
// CUSTOMER PROFILE (customer auth)
// ============================================================

router.get('/me', authenticateCustomer, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.*, b.name as business_name FROM customers c
       JOIN businesses b ON b.id = c.business_id WHERE c.id = $1`,
      [req.customer.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Compte non trouvé' });
    const c = result.rows[0];
    res.json({
      id: c.id, email: c.email, firstName: c.first_name, lastName: c.last_name,
      phone: c.phone, loyaltyPoints: c.loyalty_points, totalOrders: c.total_orders,
      totalSpent: parseFloat(c.total_spent), businessId: c.business_id,
      businessName: c.business_name, createdAt: c.created_at,
    });
  } catch (err) {
    console.error('Get customer profile error:', err);
    res.status(500).json({ error: 'Erreur' });
  }
});

router.get('/me/orders', authenticateCustomer, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT o.order_number, o.status, o.total, o.created_at, o.delivered_at
       FROM orders o WHERE o.customer_id = $1 ORDER BY o.created_at DESC LIMIT 50`,
      [req.customer.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Customer orders error:', err);
    res.status(500).json({ error: 'Erreur' });
  }
});

router.get('/me/loyalty', authenticateCustomer, async (req, res) => {
  try {
    const [points, transactions, rewards, config] = await Promise.all([
      pool.query('SELECT loyalty_points FROM customers WHERE id = $1', [req.customer.id]),
      pool.query(
        'SELECT * FROM loyalty_transactions WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 20',
        [req.customer.id]
      ),
      pool.query(
        'SELECT * FROM loyalty_rewards WHERE business_id = $1 AND is_active = true ORDER BY points_cost',
        [req.customer.businessId]
      ),
      pool.query(
        'SELECT * FROM loyalty_config WHERE business_id = $1',
        [req.customer.businessId]
      ),
    ]);

    res.json({
      points: points.rows[0]?.loyalty_points || 0,
      transactions: transactions.rows,
      rewards: rewards.rows,
      config: config.rows[0] || null,
    });
  } catch (err) {
    console.error('Customer loyalty error:', err);
    res.status(500).json({ error: 'Erreur' });
  }
});

router.post('/me/redeem', authenticateCustomer, async (req, res) => {
  const { rewardId } = req.body;
  if (!rewardId || !UUID_RE.test(rewardId)) return res.status(400).json({ error: 'rewardId requis' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const customer = await client.query('SELECT loyalty_points FROM customers WHERE id = $1 FOR UPDATE', [req.customer.id]);
    const reward = await client.query(
      'SELECT * FROM loyalty_rewards WHERE id = $1 AND business_id = $2 AND is_active = true',
      [rewardId, req.customer.businessId]
    );

    if (!reward.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Récompense non trouvée' });
    }

    const currentPoints = customer.rows[0].loyalty_points;
    const cost = reward.rows[0].points_cost;

    if (currentPoints < cost) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Points insuffisants (${currentPoints}/${cost})` });
    }

    await client.query(
      'UPDATE customers SET loyalty_points = loyalty_points - $1, updated_at = NOW() WHERE id = $2',
      [cost, req.customer.id]
    );

    await client.query(
      `INSERT INTO loyalty_transactions (customer_id, type, points, description, reward_id)
       VALUES ($1, 'redeem', $2, $3, $4)`,
      [req.customer.id, -cost, `Échange: ${reward.rows[0].name}`, rewardId]
    );

    await client.query('COMMIT');

    const r = reward.rows[0];
    let promoCode = null;

    if (r.type === 'discount_percentage' || r.type === 'discount_fixed' || r.type === 'free_delivery') {
      const code = `FIDELITE-${Date.now().toString(36).toUpperCase()}`;
      const promoType = r.type === 'discount_percentage' ? 'percentage' : r.type === 'discount_fixed' ? 'fixed' : 'free_delivery';
      await pool.query(
        `INSERT INTO promo_codes (business_id, code, type, value, max_uses, expires_at, is_active)
         VALUES ($1,$2,$3,$4,1, NOW() + INTERVAL '30 days', true)`,
        [req.customer.businessId, code, promoType, parseFloat(r.value) || 0]
      );
      promoCode = code;
    }

    res.json({
      success: true,
      reward: r.name,
      pointsSpent: cost,
      remainingPoints: currentPoints - cost,
      promoCode,
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Redeem reward error:', err);
    res.status(500).json({ error: 'Erreur' });
  } finally {
    client.release();
  }
});

// ============================================================
// MANAGER: CUSTOMER MANAGEMENT
// ============================================================

router.get('/list', authenticate, requireRole('manager'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, email, first_name, last_name, phone, loyalty_points, total_orders, total_spent,
       is_active, created_at FROM customers WHERE business_id = $1 ORDER BY created_at DESC`,
      [req.user.businessId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('List customers error:', err);
    res.status(500).json({ error: 'Erreur' });
  }
});

router.patch('/:id/points', authenticate, requireRole('manager'), async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'ID invalide' });
  const { adjustment, reason } = req.body;
  if (adjustment === undefined || isNaN(adjustment)) return res.status(400).json({ error: 'adjustment requis' });

  try {
    const customer = await pool.query(
      'SELECT id, loyalty_points FROM customers WHERE id = $1 AND business_id = $2',
      [req.params.id, req.user.businessId]
    );
    if (!customer.rows.length) return res.status(404).json({ error: 'Client non trouvé' });

    const newPoints = customer.rows[0].loyalty_points + parseInt(adjustment);
    if (newPoints < 0) return res.status(400).json({ error: 'Le solde de points ne peut pas être négatif' });

    await pool.query('UPDATE customers SET loyalty_points = $1, updated_at = NOW() WHERE id = $2', [newPoints, req.params.id]);
    await pool.query(
      `INSERT INTO loyalty_transactions (customer_id, type, points, description) VALUES ($1, 'adjustment', $2, $3)`,
      [req.params.id, parseInt(adjustment), reason?.trim() || 'Ajustement manuel']
    );

    res.json({ id: req.params.id, loyaltyPoints: newPoints });
  } catch (err) {
    console.error('Adjust points error:', err);
    res.status(500).json({ error: 'Erreur' });
  }
});

router.patch('/:id/toggle', authenticate, requireRole('manager'), async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'ID invalide' });
  try {
    const customer = await pool.query(
      'SELECT id, is_active FROM customers WHERE id = $1 AND business_id = $2',
      [req.params.id, req.user.businessId]
    );
    if (!customer.rows.length) return res.status(404).json({ error: 'Client non trouvé' });

    const newStatus = !customer.rows[0].is_active;
    await pool.query('UPDATE customers SET is_active = $1, updated_at = NOW() WHERE id = $2', [newStatus, req.params.id]);
    res.json({ id: req.params.id, isActive: newStatus });
  } catch (err) {
    console.error('Toggle customer error:', err);
    res.status(500).json({ error: 'Erreur' });
  }
});

// ============================================================
// MANAGER: LOYALTY CONFIG & REWARDS
// ============================================================

router.get('/loyalty/config', authenticate, requireRole('manager'), async (req, res) => {
  try {
    const [config, rewards] = await Promise.all([
      pool.query('SELECT * FROM loyalty_config WHERE business_id = $1', [req.user.businessId]),
      pool.query('SELECT * FROM loyalty_rewards WHERE business_id = $1 ORDER BY points_cost', [req.user.businessId]),
    ]);
    res.json({
      config: config.rows[0] || null,
      rewards: rewards.rows,
    });
  } catch (err) {
    console.error('Get loyalty config error:', err);
    res.status(500).json({ error: 'Erreur' });
  }
});

router.put('/loyalty/config', authenticate, requireRole('manager'), async (req, res) => {
  const { pointsPerEuro, isActive, welcomePoints } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO loyalty_config (business_id, points_per_euro, is_active, welcome_points)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (business_id) DO UPDATE SET
       points_per_euro = COALESCE($2, loyalty_config.points_per_euro),
       is_active = COALESCE($3, loyalty_config.is_active),
       welcome_points = COALESCE($4, loyalty_config.welcome_points),
       updated_at = NOW()
       RETURNING *`,
      [req.user.businessId, pointsPerEuro != null ? parseInt(pointsPerEuro) : 1,
       isActive != null ? isActive : true, welcomePoints != null ? parseInt(welcomePoints) : 0]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update loyalty config error:', err);
    res.status(500).json({ error: 'Erreur' });
  }
});

router.post('/loyalty/rewards', authenticate, requireRole('manager'), async (req, res) => {
  const { name, description, pointsCost, type, value } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Nom requis' });
  if (!pointsCost || parseInt(pointsCost) < 1) return res.status(400).json({ error: 'Coût en points requis (>= 1)' });

  const validTypes = ['discount_percentage', 'discount_fixed', 'free_product', 'free_delivery'];
  if (!validTypes.includes(type)) return res.status(400).json({ error: `Type invalide. Choix: ${validTypes.join(', ')}` });

  try {
    const result = await pool.query(
      `INSERT INTO loyalty_rewards (business_id, name, description, points_cost, type, value)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.user.businessId, name.trim(), description?.trim() || null,
       parseInt(pointsCost), type, parseFloat(value) || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create reward error:', err);
    res.status(500).json({ error: 'Erreur' });
  }
});

router.put('/loyalty/rewards/:id', authenticate, requireRole('manager'), async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'ID invalide' });
  const { name, description, pointsCost, type, value, isActive } = req.body;

  try {
    const result = await pool.query(
      `UPDATE loyalty_rewards SET name=COALESCE($1,name), description=COALESCE($2,description),
       points_cost=COALESCE($3,points_cost), type=COALESCE($4,type), value=COALESCE($5,value),
       is_active=COALESCE($6,is_active)
       WHERE id=$7 AND business_id=$8 RETURNING *`,
      [name?.trim(), description?.trim(), pointsCost ? parseInt(pointsCost) : null,
       type, value != null ? parseFloat(value) : null, isActive,
       req.params.id, req.user.businessId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Récompense non trouvée' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update reward error:', err);
    res.status(500).json({ error: 'Erreur' });
  }
});

router.delete('/loyalty/rewards/:id', authenticate, requireRole('manager'), async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'ID invalide' });
  try {
    const result = await pool.query(
      'DELETE FROM loyalty_rewards WHERE id = $1 AND business_id = $2 RETURNING id',
      [req.params.id, req.user.businessId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Récompense non trouvée' });
    res.json({ success: true });
  } catch (err) {
    console.error('Delete reward error:', err);
    res.status(500).json({ error: 'Erreur' });
  }
});

// ============================================================
// PUBLIC: loyalty config for a business
// ============================================================

router.get('/loyalty/public/:businessId', async (req, res) => {
  if (!UUID_RE.test(req.params.businessId)) return res.status(400).json({ error: 'ID invalide' });
  try {
    const [config, rewards] = await Promise.all([
      pool.query('SELECT points_per_euro, is_active, welcome_points FROM loyalty_config WHERE business_id = $1', [req.params.businessId]),
      pool.query('SELECT id, name, description, points_cost, type, value FROM loyalty_rewards WHERE business_id = $1 AND is_active = true ORDER BY points_cost', [req.params.businessId]),
    ]);
    res.json({
      config: config.rows[0] || null,
      rewards: rewards.rows,
    });
  } catch (err) {
    console.error('Public loyalty config error:', err);
    res.status(500).json({ error: 'Erreur' });
  }
});

export default router;
