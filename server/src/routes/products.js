import { Router } from 'express';
import pool from '../config/db.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

// Categories
router.get('/categories', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM product_categories WHERE business_id = $1 ORDER BY sort_order, name',
      [req.user.businessId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erreur' });
  }
});

router.post('/categories', authenticate, requireRole('manager'), async (req, res) => {
  const { name, description, sortOrder } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO product_categories (business_id, name, description, sort_order) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.user.businessId, name, description || null, sortOrder || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erreur' });
  }
});

// Products
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*, c.name as category_name FROM products p
       LEFT JOIN product_categories c ON c.id = p.category_id
       WHERE p.business_id = $1 ORDER BY c.sort_order, p.name`,
      [req.user.businessId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erreur' });
  }
});

router.post('/', authenticate, requireRole('manager'), async (req, res) => {
  const { name, description, price, categoryId, stockQuantity, stockAlertThreshold, imageUrl } = req.body;
  if (!name || price == null) {
    return res.status(400).json({ error: 'Nom et prix requis' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO products (business_id, category_id, name, description, price, stock_quantity, stock_alert_threshold, image_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [req.user.businessId, categoryId || null, name, description || null, price, stockQuantity || 0, stockAlertThreshold || 5, imageUrl || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erreur' });
  }
});

router.put('/:id', authenticate, requireRole('manager'), async (req, res) => {
  const { name, description, price, categoryId, stockQuantity, stockAlertThreshold, isAvailable, imageUrl } = req.body;
  try {
    const result = await pool.query(
      `UPDATE products SET name=$1, description=$2, price=$3, category_id=$4, stock_quantity=$5,
       stock_alert_threshold=$6, is_available=$7, image_url=$8, updated_at=NOW()
       WHERE id=$9 AND business_id=$10 RETURNING *`,
      [name, description, price, categoryId, stockQuantity, stockAlertThreshold, isAvailable, imageUrl, req.params.id, req.user.businessId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Produit non trouvé' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erreur' });
  }
});

router.delete('/:id', authenticate, requireRole('manager'), async (req, res) => {
  try {
    await pool.query('DELETE FROM products WHERE id = $1 AND business_id = $2', [req.params.id, req.user.businessId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erreur' });
  }
});

// Public menu (no auth)
router.get('/public/:businessId', async (req, res) => {
  try {
    const cats = await pool.query(
      'SELECT * FROM product_categories WHERE business_id = $1 ORDER BY sort_order, name',
      [req.params.businessId]
    );
    const products = await pool.query(
      `SELECT p.*, c.name as category_name FROM products p
       LEFT JOIN product_categories c ON c.id = p.category_id
       WHERE p.business_id = $1 AND p.is_available = true AND p.stock_quantity > 0
       ORDER BY c.sort_order, p.name`,
      [req.params.businessId]
    );
    const biz = await pool.query('SELECT id, name, address, phone FROM businesses WHERE id = $1', [req.params.businessId]);
    res.json({
      business: biz.rows[0] || null,
      categories: cats.rows,
      products: products.rows,
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur' });
  }
});

// Stock alerts
router.get('/alerts', authenticate, requireRole('manager'), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM products WHERE business_id = $1 AND stock_quantity <= stock_alert_threshold ORDER BY stock_quantity',
      [req.user.businessId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erreur' });
  }
});

export default router;
