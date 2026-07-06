import { Router } from 'express';
import pool from '../config/db.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { lockChain, nextLink, computeHash, verifyChain, orderFiscalPayload, cashTxPayload, closingPayload, periodClosingPayload } from '../utils/fiscalChain.js';

const router = Router();

router.get('/dashboard', authenticate, requireRole('manager'), async (req, res) => {
  try {
    const businessId = req.user.businessId;
    const today = new Date().toISOString().split('T')[0];

    const [todayOrders, statusCounts, revenue7d, topProducts, driverStats] = await Promise.all([
      pool.query(
        `SELECT COUNT(*) as total, COALESCE(SUM(total),0) as revenue,
         COUNT(*) FILTER (WHERE status = 'delivered') as delivered,
         COUNT(*) FILTER (WHERE status = 'problem') as problems
         FROM orders WHERE business_id = $1 AND DATE(created_at) = $2`,
        [businessId, today]
      ),
      pool.query(
        `SELECT status, COUNT(*) as count FROM orders WHERE business_id = $1 GROUP BY status`,
        [businessId]
      ),
      pool.query(
        `SELECT DATE(created_at) as date, COUNT(*) as orders, COALESCE(SUM(total),0) as revenue
         FROM orders WHERE business_id = $1 AND created_at >= NOW() - INTERVAL '7 days'
         GROUP BY DATE(created_at) ORDER BY date`,
        [businessId]
      ),
      pool.query(
        `SELECT oi.product_name, SUM(oi.quantity) as total_qty, SUM(oi.total_price) as total_revenue
         FROM order_items oi JOIN orders o ON o.id = oi.order_id
         WHERE o.business_id = $1 AND o.created_at >= NOW() - INTERVAL '30 days'
         GROUP BY oi.product_name ORDER BY total_qty DESC LIMIT 10`,
        [businessId]
      ),
      pool.query(
        `SELECT u.first_name, u.last_name,
         COUNT(o.id) as total_deliveries,
         COUNT(o.id) FILTER (WHERE o.status = 'delivered') as completed,
         COUNT(o.id) FILTER (WHERE o.status = 'problem') as problems
         FROM users u LEFT JOIN orders o ON o.driver_id = u.id AND o.created_at >= NOW() - INTERVAL '30 days'
         WHERE u.business_id = $1 AND u.role IN ('driver', 'manager_driver')
         GROUP BY u.id, u.first_name, u.last_name`,
        [businessId]
      ),
    ]);

    res.json({
      today: todayOrders.rows[0],
      statusBreakdown: statusCounts.rows,
      revenueTrend: revenue7d.rows,
      topProducts: topProducts.rows,
      driverPerformance: driverStats.rows,
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Erreur lors du chargement du tableau de bord' });
  }
});

// Requete commune aux clotures : chiffre d'affaires calcule sur payment_status = 'paid'
// (et non sur status = 'delivered', qui ne concerne que la livraison - un
// sur place/a emporter termine a "ready" et doit quand meme etre compte).
const CLOSING_STATS_SQL = `
  SELECT
    COUNT(*) as total_orders,
    COUNT(*) FILTER (WHERE status = 'delivered') as total_delivered,
    COUNT(*) FILTER (WHERE status = 'cancelled') as total_cancelled,
    COUNT(*) FILTER (WHERE status = 'problem') as total_problems,
    COALESCE(SUM(total) FILTER (WHERE payment_method = 'cash' AND payment_status = 'paid'), 0) as revenue_cash,
    COALESCE(SUM(total) FILTER (WHERE payment_method = 'card' AND payment_status = 'paid'), 0) as revenue_card,
    COALESCE(SUM(total) FILTER (WHERE payment_method = 'meal_voucher' AND payment_status = 'paid'), 0) as revenue_meal_voucher,
    COALESCE(SUM(total) FILTER (WHERE payment_status = 'paid'), 0) as revenue_total,
    COALESCE(SUM(discount_amount) FILTER (WHERE payment_status = 'paid'), 0) as total_discount,
    COALESCE(SUM(delivery_fee) FILTER (WHERE payment_status = 'paid'), 0) as total_delivery_fees
`;

router.post('/close-day', authenticate, requireRole('manager'), async (req, res) => {
  const { date, notes } = req.body;
  const closingDate = date || new Date().toISOString().split('T')[0];

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query(
      'SELECT id FROM daily_closings WHERE business_id = $1 AND closing_date = $2',
      [req.user.businessId, closingDate]
    );
    if (existing.rows.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Cette journée a déjà été clôturée (clôture immuable)' });
    }

    const stats = await client.query(
      `${CLOSING_STATS_SQL} FROM orders WHERE business_id = $1 AND DATE(created_at) = $2`,
      [req.user.businessId, closingDate]
    );

    const s = stats.rows[0];

    await lockChain(client, 'daily_closings', req.user.businessId);
    const { sequenceNumber, prevHash } = await nextLink(client, {
      table: 'daily_closings',
      whereSql: 'business_id = $1 AND sequence_number IS NOT NULL',
      whereParams: [req.user.businessId],
    });
    const hash = computeHash(prevHash, sequenceNumber, closingPayload({ business_id: req.user.businessId, closing_date: closingDate, ...s }));

    const result = await client.query(
      `INSERT INTO daily_closings (business_id, closing_date, total_orders, total_delivered, total_cancelled,
       total_problems, revenue_cash, revenue_card, revenue_meal_voucher, revenue_total,
       total_discount, total_delivery_fees, notes, closed_by, sequence_number, prev_hash, hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       RETURNING *`,
      [req.user.businessId, closingDate, s.total_orders, s.total_delivered, s.total_cancelled,
       s.total_problems, s.revenue_cash, s.revenue_card, s.revenue_meal_voucher, s.revenue_total,
       s.total_discount, s.total_delivery_fees, notes?.trim() || null, req.user.id, sequenceNumber, prevHash, hash]
    );

    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Close day error:', err);
    res.status(500).json({ error: 'Erreur lors de la clôture journalière' });
  } finally {
    client.release();
  }
});

router.get('/closings', authenticate, requireRole('manager'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT dc.*, u.first_name, u.last_name FROM daily_closings dc
       LEFT JOIN users u ON u.id = dc.closed_by
       WHERE dc.business_id = $1 ORDER BY dc.closing_date DESC LIMIT 30`,
      [req.user.businessId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la récupération des clôtures' });
  }
});

// Clotures mensuelle/annuelle : meme principe que la cloture journaliere,
// granularite differente (period_key = 'YYYY-MM' ou 'YYYY').
async function closePeriod(req, res, periodType, periodKey) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query(
      'SELECT id FROM period_closings WHERE business_id = $1 AND period_type = $2 AND period_key = $3',
      [req.user.businessId, periodType, periodKey]
    );
    if (existing.rows.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: `Cette période (${periodKey}) a déjà été clôturée (clôture immuable)` });
    }

    let startDate, endDate;
    if (periodType === 'monthly') {
      const [y, m] = periodKey.split('-').map(Number);
      startDate = `${periodKey}-01`;
      endDate = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
    } else {
      startDate = `${periodKey}-01-01`;
      endDate = `${Number(periodKey) + 1}-01-01`;
    }

    const stats = await client.query(
      `${CLOSING_STATS_SQL} FROM orders WHERE business_id = $1 AND created_at >= $2 AND created_at < $3`,
      [req.user.businessId, startDate, endDate]
    );

    const s = stats.rows[0];

    await lockChain(client, `period_closings:${periodType}`, req.user.businessId);
    const { sequenceNumber, prevHash } = await nextLink(client, {
      table: 'period_closings',
      whereSql: 'business_id = $1 AND period_type = $2 AND sequence_number IS NOT NULL',
      whereParams: [req.user.businessId, periodType],
    });
    const hash = computeHash(prevHash, sequenceNumber, periodClosingPayload({
      business_id: req.user.businessId, period_type: periodType, period_key: periodKey, ...s,
    }));

    const result = await client.query(
      `INSERT INTO period_closings (business_id, period_type, period_key, total_orders, total_delivered,
       total_cancelled, total_problems, revenue_cash, revenue_card, revenue_meal_voucher, revenue_total,
       total_discount, total_delivery_fees, notes, closed_by, sequence_number, prev_hash, hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       RETURNING *`,
      [req.user.businessId, periodType, periodKey, s.total_orders, s.total_delivered, s.total_cancelled,
       s.total_problems, s.revenue_cash, s.revenue_card, s.revenue_meal_voucher, s.revenue_total,
       s.total_discount, s.total_delivery_fees, req.body.notes?.trim() || null, req.user.id, sequenceNumber, prevHash, hash]
    );

    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Close period error:', err);
    res.status(500).json({ error: 'Erreur lors de la clôture' });
  } finally {
    client.release();
  }
}

router.post('/close-month', authenticate, requireRole('manager'), (req, res) => {
  const periodKey = req.body.month || new Date().toISOString().slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(periodKey)) return res.status(400).json({ error: 'Format invalide (attendu YYYY-MM)' });
  return closePeriod(req, res, 'monthly', periodKey);
});

router.post('/close-year', authenticate, requireRole('manager'), (req, res) => {
  const periodKey = req.body.year || String(new Date().getFullYear());
  if (!/^\d{4}$/.test(periodKey)) return res.status(400).json({ error: 'Format invalide (attendu YYYY)' });
  return closePeriod(req, res, 'annual', periodKey);
});

router.get('/period-closings', authenticate, requireRole('manager'), async (req, res) => {
  const { type } = req.query;
  try {
    const result = await pool.query(
      `SELECT pc.*, u.first_name, u.last_name FROM period_closings pc
       LEFT JOIN users u ON u.id = pc.closed_by
       WHERE pc.business_id = $1 ${type ? 'AND pc.period_type = $2' : ''}
       ORDER BY pc.period_key DESC LIMIT 30`,
      type ? [req.user.businessId, type] : [req.user.businessId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la récupération des clôtures' });
  }
});

// Verifie l'integrite des trois chaines fiscales (tickets encaisses, journal
// de caisse, clotures journalieres) en rejouant les hash depuis la base.
router.get('/fiscal-integrity', authenticate, requireRole('manager'), async (req, res) => {
  try {
    const businessId = req.user.businessId;

    const ordersRes = await pool.query(
      `SELECT id, order_number, business_id, subtotal, delivery_fee, discount_amount, total, payment_method,
       fiscal_sequence, fiscal_prev_hash, fiscal_hash
       FROM orders WHERE business_id = $1 AND fiscal_sequence IS NOT NULL ORDER BY fiscal_sequence ASC`,
      [businessId]
    );
    const ordersChain = verifyChain(ordersRes.rows.map(r => ({
      sequenceNumber: r.fiscal_sequence,
      prevHash: r.fiscal_prev_hash,
      hash: r.fiscal_hash,
      payload: orderFiscalPayload(r),
    })));

    const cashRes = await pool.query(
      `SELECT sequence_number, prev_hash, hash, business_id, session_id, type, payment_method, amount, label, order_id
       FROM cash_transactions WHERE business_id = $1 AND sequence_number IS NOT NULL ORDER BY sequence_number ASC`,
      [businessId]
    );
    const cashChain = verifyChain(cashRes.rows.map(r => ({
      sequenceNumber: r.sequence_number,
      prevHash: r.prev_hash,
      hash: r.hash,
      payload: cashTxPayload(r),
    })));

    const dailyRes = await pool.query(
      `SELECT * FROM daily_closings WHERE business_id = $1 AND sequence_number IS NOT NULL ORDER BY sequence_number ASC`,
      [businessId]
    );
    const dailyChain = verifyChain(dailyRes.rows.map(r => ({
      sequenceNumber: r.sequence_number,
      prevHash: r.prev_hash,
      hash: r.hash,
      payload: closingPayload(r),
    })));

    res.json({
      orders: { ...ordersChain, checkedCount: ordersRes.rows.length },
      cashTransactions: { ...cashChain, checkedCount: cashRes.rows.length },
      dailyClosings: { ...dailyChain, checkedCount: dailyRes.rows.length },
    });
  } catch (err) {
    console.error('Fiscal integrity error:', err);
    res.status(500).json({ error: 'Erreur lors de la vérification' });
  }
});

// Export fiscal (archivage) : tickets encaisses + clotures, avec les hash
// pour permettre a l'administration de verifier l'inalterabilite.
router.get('/fiscal-export', authenticate, requireRole('manager'), async (req, res) => {
  const { from, to } = req.query;
  try {
    const businessId = req.user.businessId;
    const params = [businessId];
    let dateFilter = '';
    if (from) { params.push(from); dateFilter += ` AND created_at >= $${params.length}`; }
    if (to) { params.push(to); dateFilter += ` AND created_at < $${params.length}`; }

    const orders = await pool.query(
      `SELECT id, order_number, order_type, payment_method, subtotal, delivery_fee, discount_amount, total,
       fiscal_sequence, fiscal_prev_hash, fiscal_hash, created_at, delivered_at
       FROM orders WHERE business_id = $1 AND fiscal_sequence IS NOT NULL ${dateFilter} ORDER BY fiscal_sequence ASC`,
      params
    );
    const dailyClosings = await pool.query(
      'SELECT * FROM daily_closings WHERE business_id = $1 ORDER BY closing_date ASC',
      [businessId]
    );
    const periodClosings = await pool.query(
      'SELECT * FROM period_closings WHERE business_id = $1 ORDER BY period_type ASC, period_key ASC',
      [businessId]
    );

    res.json({
      businessId,
      exportedAt: new Date().toISOString(),
      tickets: orders.rows,
      dailyClosings: dailyClosings.rows,
      periodClosings: periodClosings.rows,
    });
  } catch (err) {
    console.error('Fiscal export error:', err);
    res.status(500).json({ error: 'Erreur lors de l\'export fiscal' });
  }
});

export default router;
