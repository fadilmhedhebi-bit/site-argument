import { Router } from 'express';
import pool from '../config/db.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

router.get('/', authenticate, requireRole('manager'), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM ingredients WHERE business_id = $1 ORDER BY name',
      [req.user.businessId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('List ingredients error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des ingrédients' });
  }
});

router.get('/alerts', authenticate, requireRole('manager'), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM ingredients WHERE business_id = $1 AND quantity <= alert_threshold ORDER BY quantity ASC',
      [req.user.businessId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Ingredient alerts error:', err);
    res.status(500).json({ error: 'Erreur' });
  }
});

router.post('/', authenticate, requireRole('manager'), async (req, res) => {
  const { name, unit, quantity, alertThreshold, costPerUnit, supplier } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Nom requis' });

  try {
    const result = await pool.query(
      `INSERT INTO ingredients (business_id, name, unit, quantity, alert_threshold, cost_per_unit, supplier)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.user.businessId, name.trim(), unit?.trim() || 'unité',
       parseFloat(quantity) || 0, parseFloat(alertThreshold) || 5,
       parseFloat(costPerUnit) || 0, supplier?.trim() || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create ingredient error:', err);
    res.status(500).json({ error: 'Erreur lors de la création' });
  }
});

router.put('/:id', authenticate, requireRole('manager'), async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'ID invalide' });
  const { name, unit, quantity, alertThreshold, costPerUnit, supplier } = req.body;

  try {
    const result = await pool.query(
      `UPDATE ingredients SET name=COALESCE($1,name), unit=COALESCE($2,unit), quantity=COALESCE($3,quantity),
       alert_threshold=COALESCE($4,alert_threshold), cost_per_unit=COALESCE($5,cost_per_unit),
       supplier=COALESCE($6,supplier), updated_at=NOW()
       WHERE id=$7 AND business_id=$8 RETURNING *`,
      [name?.trim(), unit?.trim(), quantity != null ? parseFloat(quantity) : null,
       alertThreshold != null ? parseFloat(alertThreshold) : null,
       costPerUnit != null ? parseFloat(costPerUnit) : null,
       supplier?.trim(), req.params.id, req.user.businessId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Ingrédient non trouvé' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update ingredient error:', err);
    res.status(500).json({ error: 'Erreur lors de la modification' });
  }
});

router.patch('/:id/stock', authenticate, requireRole('manager'), async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'ID invalide' });
  const { adjustment, type, note } = req.body;

  if (adjustment === undefined || isNaN(adjustment)) {
    return res.status(400).json({ error: 'adjustment requis (nombre)' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const current = await client.query(
      'SELECT id, quantity FROM ingredients WHERE id = $1 AND business_id = $2',
      [req.params.id, req.user.businessId]
    );
    if (!current.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Ingrédient non trouvé' });
    }

    const newQty = parseFloat(current.rows[0].quantity) + parseFloat(adjustment);
    if (newQty < 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Stock insuffisant' });
    }

    await client.query(
      'UPDATE ingredients SET quantity = $1, updated_at = NOW() WHERE id = $2',
      [newQty, req.params.id]
    );

    await client.query(
      'INSERT INTO ingredient_movements (ingredient_id, type, quantity, note, created_by) VALUES ($1,$2,$3,$4,$5)',
      [req.params.id, type || (parseFloat(adjustment) > 0 ? 'in' : 'out'),
       Math.abs(parseFloat(adjustment)), note?.trim() || null, req.user.id]
    );

    await client.query('COMMIT');

    const updated = await pool.query('SELECT * FROM ingredients WHERE id = $1', [req.params.id]);
    res.json(updated.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Adjust ingredient stock error:', err);
    res.status(500).json({ error: 'Erreur' });
  } finally {
    client.release();
  }
});

router.get('/:id/movements', authenticate, requireRole('manager'), async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'ID invalide' });
  try {
    const result = await pool.query(
      `SELECT m.*, u.first_name, u.last_name FROM ingredient_movements m
       LEFT JOIN users u ON u.id = m.created_by
       WHERE m.ingredient_id = $1 ORDER BY m.created_at DESC LIMIT 50`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('List movements error:', err);
    res.status(500).json({ error: 'Erreur' });
  }
});

router.delete('/:id', authenticate, requireRole('manager'), async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'ID invalide' });
  try {
    const result = await pool.query(
      'DELETE FROM ingredients WHERE id = $1 AND business_id = $2 RETURNING id',
      [req.params.id, req.user.businessId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Ingrédient non trouvé' });
    res.json({ success: true });
  } catch (err) {
    console.error('Delete ingredient error:', err);
    res.status(500).json({ error: 'Erreur lors de la suppression' });
  }
});

export default router;
