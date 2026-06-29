import { Router } from 'express';
import pool from '../config/db.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { optimizeRoute } from '../utils/route-optimizer.js';

const router = Router();

router.get('/', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT t.*, u.first_name as driver_first_name, u.last_name as driver_last_name,
       (SELECT COUNT(*) FROM orders WHERE tour_id = t.id) as order_count
       FROM tours t JOIN users u ON u.id = t.driver_id
       WHERE t.business_id = $1 ORDER BY t.created_at DESC`,
      [req.user.businessId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erreur' });
  }
});

router.post('/', authenticate, requireRole('manager'), async (req, res) => {
  const { driverId, name, orderIds, startLatitude, startLongitude } = req.body;
  if (!driverId || !orderIds?.length) {
    return res.status(400).json({ error: 'Livreur et commandes requis' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const tourResult = await client.query(
      `INSERT INTO tours (business_id, driver_id, name, start_latitude, start_longitude)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.user.businessId, driverId, name || `Tournée ${new Date().toLocaleDateString('fr-FR')}`, startLatitude || null, startLongitude || null]
    );
    const tourId = tourResult.rows[0].id;

    const orders = await client.query(
      'SELECT id, delivery_latitude, delivery_longitude FROM orders WHERE id = ANY($1) AND business_id = $2',
      [orderIds, req.user.businessId]
    );

    let stopOrder;
    if (startLatitude && startLongitude) {
      const start = { lat: startLatitude, lng: startLongitude };
      const stops = orders.rows
        .filter(o => o.delivery_latitude && o.delivery_longitude)
        .map(o => ({ lat: o.delivery_latitude, lng: o.delivery_longitude, id: o.id }));

      if (stops.length > 0) {
        const optimizedIndices = optimizeRoute(start, stops);
        stopOrder = optimizedIndices.map((idx, pos) => ({ id: stops[idx].id, order: pos + 1 }));

        const unoptimized = orders.rows.filter(o => !o.delivery_latitude || !o.delivery_longitude);
        let pos = stopOrder.length + 1;
        for (const o of unoptimized) {
          stopOrder.push({ id: o.id, order: pos++ });
        }
      }
    }

    if (!stopOrder) {
      stopOrder = orders.rows.map((o, i) => ({ id: o.id, order: i + 1 }));
    }

    for (const s of stopOrder) {
      await client.query(
        'UPDATE orders SET tour_id = $1, stop_order = $2, driver_id = $3, status = CASE WHEN status = \'pending\' THEN \'confirmed\' ELSE status END, updated_at = NOW() WHERE id = $4',
        [tourId, s.order, driverId, s.id]
      );
    }

    await client.query(
      'UPDATE tours SET optimized_route = $1 WHERE id = $2',
      [JSON.stringify(stopOrder), tourId]
    );

    await client.query('COMMIT');
    res.status(201).json({ ...tourResult.rows[0], stops: stopOrder });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create tour error:', err);
    res.status(500).json({ error: 'Erreur' });
  } finally {
    client.release();
  }
});

router.patch('/:id/status', authenticate, async (req, res) => {
  const { status } = req.body;
  try {
    const extra = status === 'in_progress' ? ', started_at = NOW()' : status === 'completed' ? ', completed_at = NOW()' : '';
    const result = await pool.query(
      `UPDATE tours SET status = $1, updated_at = NOW() ${extra} WHERE id = $2 AND business_id = $3 RETURNING *`,
      [status, req.params.id, req.user.businessId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Tournée non trouvée' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erreur' });
  }
});

router.post('/:id/optimize', authenticate, requireRole('manager'), async (req, res) => {
  try {
    const tour = await pool.query('SELECT * FROM tours WHERE id = $1 AND business_id = $2', [req.params.id, req.user.businessId]);
    if (!tour.rows.length) return res.status(404).json({ error: 'Tournée non trouvée' });

    const t = tour.rows[0];
    if (!t.start_latitude || !t.start_longitude) {
      return res.status(400).json({ error: 'Position de départ requise pour l\'optimisation' });
    }

    const orders = await pool.query(
      'SELECT id, delivery_latitude, delivery_longitude FROM orders WHERE tour_id = $1 AND delivery_latitude IS NOT NULL AND delivery_longitude IS NOT NULL',
      [req.params.id]
    );

    const start = { lat: t.start_latitude, lng: t.start_longitude };
    const stops = orders.rows.map(o => ({ lat: o.delivery_latitude, lng: o.delivery_longitude, id: o.id }));
    const optimizedIndices = optimizeRoute(start, stops);
    const stopOrder = optimizedIndices.map((idx, pos) => ({ id: stops[idx].id, order: pos + 1 }));

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const s of stopOrder) {
        await client.query('UPDATE orders SET stop_order = $1 WHERE id = $2', [s.order, s.id]);
      }
      await client.query('UPDATE tours SET optimized_route = $1, updated_at = NOW() WHERE id = $2', [JSON.stringify(stopOrder), req.params.id]);
      await client.query('COMMIT');
      res.json({ stops: stopOrder });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    res.status(500).json({ error: 'Erreur' });
  }
});

export default router;
