import { Router } from 'express';
import pool from '../config/db.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticate, requireRole('manager'), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM promo_codes WHERE business_id = $1 ORDER BY created_at DESC',
      [req.user.businessId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erreur' });
  }
});

router.post('/', authenticate, requireRole('manager'), async (req, res) => {
  const { code, type, value, minOrderAmount, maxUses, startsAt, expiresAt } = req.body;
  if (!code || !type) return res.status(400).json({ error: 'Code et type requis' });

  try {
    const result = await pool.query(
      `INSERT INTO promo_codes (business_id, code, type, value, min_order_amount, max_uses, starts_at, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.user.businessId, code.toUpperCase(), type, value || 0, minOrderAmount || 0, maxUses || null, startsAt || null, expiresAt || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Ce code existe déjà' });
    res.status(500).json({ error: 'Erreur' });
  }
});

router.patch('/:id', authenticate, requireRole('manager'), async (req, res) => {
  const { isActive } = req.body;
  try {
    const result = await pool.query(
      'UPDATE promo_codes SET is_active = $1 WHERE id = $2 AND business_id = $3 RETURNING *',
      [isActive, req.params.id, req.user.businessId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Code promo non trouvé' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erreur' });
  }
});

router.delete('/:id', authenticate, requireRole('manager'), async (req, res) => {
  try {
    await pool.query('DELETE FROM promo_codes WHERE id = $1 AND business_id = $2', [req.params.id, req.user.businessId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erreur' });
  }
});

export default router;
