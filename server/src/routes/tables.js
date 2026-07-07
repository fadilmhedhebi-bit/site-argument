import { Router } from 'express';
import pool from '../config/db.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { requirePlanModule } from '../middleware/planGate.js';

const router = Router();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

router.get('/', authenticate, requirePlanModule('tables'), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM restaurant_tables WHERE business_id = $1 ORDER BY table_number',
      [req.user.businessId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('List tables error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des tables' });
  }
});

router.post('/', authenticate, requirePlanModule('tables'), requireRole('manager'), async (req, res) => {
  const { tableNumber, capacity } = req.body;
  if (!tableNumber || isNaN(tableNumber) || parseInt(tableNumber) < 1) {
    return res.status(400).json({ error: 'Numéro de table invalide' });
  }
  if (!capacity || isNaN(capacity) || parseInt(capacity) < 1) {
    return res.status(400).json({ error: 'Capacité invalide (min. 1)' });
  }
  try {
    const result = await pool.query(
      'INSERT INTO restaurant_tables (business_id, table_number, capacity) VALUES ($1, $2, $3) RETURNING *',
      [req.user.businessId, parseInt(tableNumber), parseInt(capacity)]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Ce numéro de table existe déjà' });
    }
    console.error('Create table error:', err);
    res.status(500).json({ error: 'Erreur lors de la création de la table' });
  }
});

router.put('/:id', authenticate, requirePlanModule('tables'), requireRole('manager'), async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'ID invalide' });
  const { tableNumber, capacity, status } = req.body;

  try {
    const result = await pool.query(
      `UPDATE restaurant_tables SET table_number = COALESCE($1, table_number),
       capacity = COALESCE($2, capacity), status = COALESCE($3, status),
       updated_at = NOW() WHERE id = $4 AND business_id = $5 RETURNING *`,
      [tableNumber ? parseInt(tableNumber) : null, capacity ? parseInt(capacity) : null,
       status || null, req.params.id, req.user.businessId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Table non trouvée' });
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Ce numéro de table existe déjà' });
    }
    console.error('Update table error:', err);
    res.status(500).json({ error: 'Erreur lors de la modification de la table' });
  }
});

router.patch('/:id/status', authenticate, requirePlanModule('tables'), async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'ID invalide' });
  const { status } = req.body;
  if (!['available', 'occupied', 'reserved'].includes(status)) {
    return res.status(400).json({ error: 'Statut invalide' });
  }
  try {
    const result = await pool.query(
      'UPDATE restaurant_tables SET status = $1, updated_at = NOW() WHERE id = $2 AND business_id = $3 RETURNING *',
      [status, req.params.id, req.user.businessId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Table non trouvée' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update table status error:', err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du statut' });
  }
});

router.delete('/:id', authenticate, requirePlanModule('tables'), requireRole('manager'), async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'ID invalide' });
  try {
    const result = await pool.query(
      'DELETE FROM restaurant_tables WHERE id = $1 AND business_id = $2 RETURNING id',
      [req.params.id, req.user.businessId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Table non trouvée' });
    res.json({ success: true });
  } catch (err) {
    console.error('Delete table error:', err);
    res.status(500).json({ error: 'Erreur lors de la suppression de la table' });
  }
});

export default router;
