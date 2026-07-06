import { Router } from 'express';
import pool from '../config/db.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { lockChain, nextLink, computeHash, verifyChain, cashTxPayload } from '../utils/fiscalChain.js';

const router = Router();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

router.get('/current', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT cs.*, u.first_name || ' ' || u.last_name as opened_by_name
       FROM cash_sessions cs JOIN users u ON u.id = cs.opened_by
       WHERE cs.business_id = $1 AND cs.status = 'open' ORDER BY cs.opened_at DESC LIMIT 1`,
      [req.user.businessId]
    );
    if (!result.rows.length) return res.json(null);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get current session error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération de la session' });
  }
});

router.get('/history', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT cs.*, u.first_name || ' ' || u.last_name as opened_by_name,
       u2.first_name || ' ' || u2.last_name as closed_by_name
       FROM cash_sessions cs
       JOIN users u ON u.id = cs.opened_by
       LEFT JOIN users u2 ON u2.id = cs.closed_by
       WHERE cs.business_id = $1 ORDER BY cs.opened_at DESC LIMIT 30`,
      [req.user.businessId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Cash history error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération de l\'historique' });
  }
});

router.post('/open', authenticate, requireRole('manager'), async (req, res) => {
  const { openingFloat } = req.body;
  if (openingFloat == null || isNaN(openingFloat) || parseFloat(openingFloat) < 0) {
    return res.status(400).json({ error: 'Fond de caisse invalide' });
  }

  try {
    const existing = await pool.query(
      "SELECT id FROM cash_sessions WHERE business_id = $1 AND status = 'open'",
      [req.user.businessId]
    );
    if (existing.rows.length) {
      return res.status(400).json({ error: 'Une session de caisse est déjà ouverte' });
    }

    const result = await pool.query(
      'INSERT INTO cash_sessions (business_id, opened_by, opening_float) VALUES ($1, $2, $3) RETURNING *',
      [req.user.businessId, req.user.id, parseFloat(openingFloat)]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Open cash session error:', err);
    res.status(500).json({ error: 'Erreur lors de l\'ouverture de la caisse' });
  }
});

router.post('/transaction', authenticate, async (req, res) => {
  const { type, paymentMethod, amount, label, orderId } = req.body;
  if (!type || !['sale', 'refund', 'expense', 'deposit', 'withdrawal'].includes(type)) {
    return res.status(400).json({ error: 'Type de transaction invalide' });
  }
  if (!paymentMethod || !['cash', 'card', 'meal_voucher'].includes(paymentMethod)) {
    return res.status(400).json({ error: 'Méthode de paiement invalide' });
  }
  if (amount == null || isNaN(amount) || parseFloat(amount) <= 0) {
    return res.status(400).json({ error: 'Montant invalide' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const session = await client.query(
      "SELECT id FROM cash_sessions WHERE business_id = $1 AND status = 'open'",
      [req.user.businessId]
    );
    if (!session.rows.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Aucune session de caisse ouverte' });
    }

    const sessionId = session.rows[0].id;
    const businessId = req.user.businessId;
    const parsedAmount = parseFloat(amount);
    const trimmedLabel = label?.trim() || null;

    await lockChain(client, 'cash_transactions', businessId);
    const { sequenceNumber, prevHash } = await nextLink(client, {
      table: 'cash_transactions',
      whereSql: 'business_id = $1 AND sequence_number IS NOT NULL',
      whereParams: [businessId],
    });
    const hash = computeHash(prevHash, sequenceNumber, cashTxPayload({
      business_id: businessId, session_id: sessionId, type, payment_method: paymentMethod,
      amount: parsedAmount, label: trimmedLabel, order_id: orderId || null,
    }));

    await client.query(
      `INSERT INTO cash_transactions (session_id, business_id, type, payment_method, amount, label, order_id, created_by, sequence_number, prev_hash, hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [sessionId, businessId, type, paymentMethod, parsedAmount, trimmedLabel, orderId || null, req.user.id, sequenceNumber, prevHash, hash]
    );

    const sign = ['sale', 'deposit'].includes(type) ? 1 : -1;
    const cashCol = paymentMethod === 'cash' ? 'total_cash' : paymentMethod === 'card' ? 'total_card' : 'total_meal_voucher';

    await client.query(
      `UPDATE cash_sessions SET ${cashCol} = ${cashCol} + $1,
       total_sales = total_sales + $2, transaction_count = transaction_count + 1
       WHERE id = $3`,
      [parsedAmount * sign, parsedAmount * sign, sessionId]
    );

    const updated = await client.query('SELECT * FROM cash_sessions WHERE id = $1', [sessionId]);
    await client.query('COMMIT');
    res.json(updated.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Cash transaction error:', err);
    res.status(500).json({ error: 'Erreur lors de l\'enregistrement de la transaction' });
  } finally {
    client.release();
  }
});

router.get('/verify-chain', authenticate, requireRole('manager'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT sequence_number, prev_hash, hash, business_id, session_id, type, payment_method, amount, label, order_id
       FROM cash_transactions WHERE business_id = $1 AND sequence_number IS NOT NULL ORDER BY sequence_number ASC`,
      [req.user.businessId]
    );
    const entries = result.rows.map(r => ({
      sequenceNumber: r.sequence_number,
      prevHash: r.prev_hash,
      hash: r.hash,
      payload: cashTxPayload(r),
    }));
    const verification = verifyChain(entries);
    res.json({ ...verification, checkedCount: entries.length });
  } catch (err) {
    console.error('Verify cash chain error:', err);
    res.status(500).json({ error: 'Erreur lors de la vérification' });
  }
});

router.get('/transactions', authenticate, async (req, res) => {
  const { sessionId } = req.query;
  if (!sessionId || !UUID_RE.test(sessionId)) {
    return res.status(400).json({ error: 'ID de session invalide' });
  }
  try {
    const result = await pool.query(
      `SELECT ct.*, u.first_name || ' ' || u.last_name as created_by_name
       FROM cash_transactions ct
       LEFT JOIN users u ON u.id = ct.created_by
       WHERE ct.session_id = $1 ORDER BY ct.created_at DESC`,
      [sessionId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('List transactions error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des transactions' });
  }
});

router.post('/close', authenticate, requireRole('manager'), async (req, res) => {
  const { closingAmount, notes } = req.body;
  if (closingAmount == null || isNaN(closingAmount) || parseFloat(closingAmount) < 0) {
    return res.status(400).json({ error: 'Montant de fermeture invalide' });
  }

  try {
    const session = await pool.query(
      "SELECT * FROM cash_sessions WHERE business_id = $1 AND status = 'open'",
      [req.user.businessId]
    );
    if (!session.rows.length) {
      return res.status(400).json({ error: 'Aucune session de caisse ouverte' });
    }

    const s = session.rows[0];
    const expected = parseFloat(s.opening_float) + parseFloat(s.total_cash);
    const closing = parseFloat(closingAmount);
    const diff = closing - expected;

    const result = await pool.query(
      `UPDATE cash_sessions SET status = 'closed', closed_by = $1, closing_amount = $2,
       expected_amount = $3, difference = $4, notes = $5, closed_at = NOW()
       WHERE id = $6 RETURNING *`,
      [req.user.id, closing, expected, diff, notes?.trim() || null, s.id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Close cash session error:', err);
    res.status(500).json({ error: 'Erreur lors de la fermeture de la caisse' });
  }
});

export default router;
