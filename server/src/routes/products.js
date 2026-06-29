import { Router } from 'express';
import pool from '../config/db.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ============================================================
// CATEGORIES
// ============================================================

// GET /api/products/categories
router.get('/categories', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM product_categories WHERE business_id = $1 ORDER BY sort_order, name',
      [req.user.businessId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('List categories error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des catégories' });
  }
});

// POST /api/products/categories
router.post('/categories', authenticate, requireRole('manager'), async (req, res) => {
  const { name, description, sortOrder } = req.body;
  if (!name?.trim()) {
    return res.status(400).json({ error: 'Nom de catégorie requis' });
  }
  try {
    const result = await pool.query(
      'INSERT INTO product_categories (business_id, name, description, sort_order) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.user.businessId, name.trim(), description?.trim() || null, parseInt(sortOrder) || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create category error:', err);
    res.status(500).json({ error: 'Erreur lors de la création de la catégorie' });
  }
});

// PUT /api/products/categories/:id
router.put('/categories/:id', authenticate, requireRole('manager'), async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'ID invalide' });
  const { name, description, sortOrder } = req.body;

  try {
    const result = await pool.query(
      'UPDATE product_categories SET name = COALESCE($1, name), description = COALESCE($2, description), sort_order = COALESCE($3, sort_order) WHERE id = $4 AND business_id = $5 RETURNING *',
      [name?.trim(), description?.trim(), sortOrder != null ? parseInt(sortOrder) : null, req.params.id, req.user.businessId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Catégorie non trouvée' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update category error:', err);
    res.status(500).json({ error: 'Erreur lors de la modification de la catégorie' });
  }
});

// DELETE /api/products/categories/:id
router.delete('/categories/:id', authenticate, requireRole('manager'), async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'ID invalide' });
  try {
    const result = await pool.query(
      'DELETE FROM product_categories WHERE id = $1 AND business_id = $2 RETURNING id',
      [req.params.id, req.user.businessId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Catégorie non trouvée' });
    res.json({ success: true });
  } catch (err) {
    console.error('Delete category error:', err);
    res.status(500).json({ error: 'Erreur lors de la suppression de la catégorie' });
  }
});

// ============================================================
// PRODUCTS
// ============================================================

// GET /api/products - Liste des produits du commerce
router.get('/', authenticate, async (req, res) => {
  try {
    const { categoryId, available } = req.query;
    let query = `SELECT p.*, c.name as category_name FROM products p
       LEFT JOIN product_categories c ON c.id = p.category_id
       WHERE p.business_id = $1`;
    const params = [req.user.businessId];
    let idx = 2;

    if (categoryId) {
      if (!UUID_RE.test(categoryId)) return res.status(400).json({ error: 'categoryId invalide' });
      query += ` AND p.category_id = $${idx++}`;
      params.push(categoryId);
    }
    if (available !== undefined) {
      query += ` AND p.is_available = $${idx++}`;
      params.push(available === 'true');
    }

    query += ' ORDER BY c.sort_order, p.name';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('List products error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des produits' });
  }
});

// GET /api/products/alerts - Alertes de stock
router.get('/alerts', authenticate, requireRole('manager'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, stock_quantity, stock_alert_threshold, category_id
       FROM products WHERE business_id = $1 AND stock_quantity <= stock_alert_threshold AND is_available = true
       ORDER BY stock_quantity ASC`,
      [req.user.businessId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Stock alerts error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des alertes de stock' });
  }
});

// GET /api/products/:id - Détail d'un produit
router.get('/:id', authenticate, async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'ID invalide' });
  try {
    const result = await pool.query(
      `SELECT p.*, c.name as category_name FROM products p
       LEFT JOIN product_categories c ON c.id = p.category_id
       WHERE p.id = $1 AND p.business_id = $2`,
      [req.params.id, req.user.businessId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Produit non trouvé' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get product error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération du produit' });
  }
});

// POST /api/products - Créer un produit
router.post('/', authenticate, requireRole('manager'), async (req, res) => {
  const { name, description, price, categoryId, stockQuantity, stockAlertThreshold, imageUrl } = req.body;

  if (!name?.trim()) return res.status(400).json({ error: 'Nom du produit requis' });
  if (price == null || isNaN(price) || parseFloat(price) < 0) {
    return res.status(400).json({ error: 'Prix invalide (nombre >= 0)' });
  }
  if (categoryId && !UUID_RE.test(categoryId)) return res.status(400).json({ error: 'categoryId invalide' });
  if (stockQuantity != null && (isNaN(stockQuantity) || parseInt(stockQuantity) < 0)) {
    return res.status(400).json({ error: 'Quantité de stock invalide' });
  }

  try {
    if (categoryId) {
      const cat = await pool.query('SELECT id FROM product_categories WHERE id = $1 AND business_id = $2', [categoryId, req.user.businessId]);
      if (!cat.rows.length) return res.status(400).json({ error: 'Catégorie non trouvée' });
    }

    const result = await pool.query(
      `INSERT INTO products (business_id, category_id, name, description, price, stock_quantity, stock_alert_threshold, image_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [req.user.businessId, categoryId || null, name.trim(), description?.trim() || null,
       parseFloat(price), parseInt(stockQuantity) || 0, parseInt(stockAlertThreshold) || 5, imageUrl?.trim() || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create product error:', err);
    res.status(500).json({ error: 'Erreur lors de la création du produit' });
  }
});

// PUT /api/products/:id - Modifier un produit
router.put('/:id', authenticate, requireRole('manager'), async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'ID invalide' });

  const { name, description, price, categoryId, stockQuantity, stockAlertThreshold, isAvailable, imageUrl } = req.body;

  if (name !== undefined && !name?.trim()) return res.status(400).json({ error: 'Nom du produit ne peut pas être vide' });
  if (price !== undefined && (isNaN(price) || parseFloat(price) < 0)) return res.status(400).json({ error: 'Prix invalide' });

  try {
    const existing = await pool.query('SELECT id FROM products WHERE id = $1 AND business_id = $2', [req.params.id, req.user.businessId]);
    if (!existing.rows.length) return res.status(404).json({ error: 'Produit non trouvé' });

    const result = await pool.query(
      `UPDATE products SET name=$1, description=$2, price=$3, category_id=$4, stock_quantity=$5,
       stock_alert_threshold=$6, is_available=$7, image_url=$8, updated_at=NOW()
       WHERE id=$9 AND business_id=$10 RETURNING *`,
      [name?.trim(), description?.trim() ?? null, parseFloat(price), categoryId || null,
       parseInt(stockQuantity) ?? 0, parseInt(stockAlertThreshold) || 5,
       isAvailable !== undefined ? isAvailable : true, imageUrl?.trim() || null,
       req.params.id, req.user.businessId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update product error:', err);
    res.status(500).json({ error: 'Erreur lors de la modification du produit' });
  }
});

// PATCH /api/products/:id/stock - Ajuster le stock (add/remove)
router.patch('/:id/stock', authenticate, requireRole('manager'), async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'ID invalide' });

  const { adjustment, absolute } = req.body;

  if (absolute !== undefined) {
    if (isNaN(absolute) || parseInt(absolute) < 0) {
      return res.status(400).json({ error: 'Valeur de stock absolue invalide (entier >= 0)' });
    }
    try {
      const result = await pool.query(
        'UPDATE products SET stock_quantity = $1, updated_at = NOW() WHERE id = $2 AND business_id = $3 RETURNING id, name, stock_quantity, stock_alert_threshold',
        [parseInt(absolute), req.params.id, req.user.businessId]
      );
      if (!result.rows.length) return res.status(404).json({ error: 'Produit non trouvé' });
      const p = result.rows[0];
      res.json({ ...p, alert: p.stock_quantity <= p.stock_alert_threshold });
    } catch (err) {
      console.error('Set stock error:', err);
      res.status(500).json({ error: 'Erreur lors de la mise à jour du stock' });
    }
    return;
  }

  if (adjustment === undefined || isNaN(adjustment) || !Number.isInteger(adjustment)) {
    return res.status(400).json({ error: 'Fournir adjustment (entier +/-) ou absolute (entier >= 0)' });
  }

  try {
    const current = await pool.query(
      'SELECT stock_quantity FROM products WHERE id = $1 AND business_id = $2',
      [req.params.id, req.user.businessId]
    );
    if (!current.rows.length) return res.status(404).json({ error: 'Produit non trouvé' });

    const newQty = current.rows[0].stock_quantity + adjustment;
    if (newQty < 0) {
      return res.status(400).json({ error: `Stock insuffisant (actuel: ${current.rows[0].stock_quantity}, ajustement: ${adjustment})` });
    }

    const result = await pool.query(
      'UPDATE products SET stock_quantity = $1, updated_at = NOW() WHERE id = $2 RETURNING id, name, stock_quantity, stock_alert_threshold',
      [newQty, req.params.id]
    );
    const p = result.rows[0];
    res.json({ ...p, alert: p.stock_quantity <= p.stock_alert_threshold });
  } catch (err) {
    console.error('Adjust stock error:', err);
    res.status(500).json({ error: 'Erreur lors de l\'ajustement du stock' });
  }
});

// DELETE /api/products/:id
router.delete('/:id', authenticate, requireRole('manager'), async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'ID invalide' });

  try {
    const orderCount = await pool.query(
      'SELECT COUNT(*) as c FROM order_items WHERE product_id = $1',
      [req.params.id]
    );
    if (parseInt(orderCount.rows[0].c) > 0) {
      await pool.query(
        'UPDATE products SET is_available = false, updated_at = NOW() WHERE id = $1 AND business_id = $2',
        [req.params.id, req.user.businessId]
      );
      return res.json({ success: true, message: 'Produit désactivé (lié à des commandes existantes)' });
    }

    const result = await pool.query(
      'DELETE FROM products WHERE id = $1 AND business_id = $2 RETURNING id',
      [req.params.id, req.user.businessId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Produit non trouvé' });
    res.json({ success: true, message: 'Produit supprimé' });
  } catch (err) {
    console.error('Delete product error:', err);
    res.status(500).json({ error: 'Erreur lors de la suppression du produit' });
  }
});

// GET /api/products/public/:businessId - Menu public (pas d'auth)
router.get('/public/:businessId', async (req, res) => {
  if (!UUID_RE.test(req.params.businessId)) return res.status(400).json({ error: 'Business ID invalide' });

  try {
    const [biz, cats, products] = await Promise.all([
      pool.query('SELECT id, name, address, phone FROM businesses WHERE id = $1', [req.params.businessId]),
      pool.query('SELECT * FROM product_categories WHERE business_id = $1 ORDER BY sort_order, name', [req.params.businessId]),
      pool.query(
        `SELECT p.id, p.name, p.description, p.price, p.image_url, p.category_id, c.name as category_name
         FROM products p LEFT JOIN product_categories c ON c.id = p.category_id
         WHERE p.business_id = $1 AND p.is_available = true AND p.stock_quantity > 0
         ORDER BY c.sort_order, p.name`,
        [req.params.businessId]
      ),
    ]);

    if (!biz.rows.length) return res.status(404).json({ error: 'Commerce non trouvé' });

    res.json({
      business: biz.rows[0],
      categories: cats.rows,
      products: products.rows,
    });
  } catch (err) {
    console.error('Public menu error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération du menu' });
  }
});

export default router;
