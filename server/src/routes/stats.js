import { Router } from 'express';
import pool from '../config/db.js';
import { authenticate, requireRole } from '../middleware/auth.js';

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
    res.status(500).json({ error: 'Erreur' });
  }
});

router.post('/close-day', authenticate, requireRole('manager'), async (req, res) => {
  const { date, notes } = req.body;
  const closingDate = date || new Date().toISOString().split('T')[0];

  try {
    const stats = await pool.query(
      `SELECT
        COUNT(*) as total_orders,
        COUNT(*) FILTER (WHERE status = 'delivered') as total_delivered,
        COUNT(*) FILTER (WHERE status = 'cancelled') as total_cancelled,
        COUNT(*) FILTER (WHERE status = 'problem') as total_problems,
        COALESCE(SUM(total) FILTER (WHERE payment_method = 'cash' AND status = 'delivered'), 0) as revenue_cash,
        COALESCE(SUM(total) FILTER (WHERE payment_method = 'card' AND status = 'delivered'), 0) as revenue_card,
        COALESCE(SUM(total) FILTER (WHERE payment_method = 'meal_voucher' AND status = 'delivered'), 0) as revenue_meal_voucher,
        COALESCE(SUM(total) FILTER (WHERE status = 'delivered'), 0) as revenue_total,
        COALESCE(SUM(discount_amount) FILTER (WHERE status = 'delivered'), 0) as total_discount,
        COALESCE(SUM(delivery_fee) FILTER (WHERE status = 'delivered'), 0) as total_delivery_fees
       FROM orders WHERE business_id = $1 AND DATE(created_at) = $2`,
      [req.user.businessId, closingDate]
    );

    const s = stats.rows[0];
    const result = await pool.query(
      `INSERT INTO daily_closings (business_id, closing_date, total_orders, total_delivered, total_cancelled,
       total_problems, revenue_cash, revenue_card, revenue_meal_voucher, revenue_total,
       total_discount, total_delivery_fees, notes, closed_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT (business_id, closing_date) DO UPDATE SET
       total_orders=$3, total_delivered=$4, total_cancelled=$5, total_problems=$6,
       revenue_cash=$7, revenue_card=$8, revenue_meal_voucher=$9, revenue_total=$10,
       total_discount=$11, total_delivery_fees=$12, notes=$13, closed_by=$14
       RETURNING *`,
      [req.user.businessId, closingDate, s.total_orders, s.total_delivered, s.total_cancelled,
       s.total_problems, s.revenue_cash, s.revenue_card, s.revenue_meal_voucher, s.revenue_total,
       s.total_discount, s.total_delivery_fees, notes || null, req.user.id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Close day error:', err);
    res.status(500).json({ error: 'Erreur' });
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
    res.status(500).json({ error: 'Erreur' });
  }
});

export default router;
