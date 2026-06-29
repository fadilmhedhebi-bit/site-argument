import { Router } from 'express';
import pool from '../config/db.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { optimizeRoute } from '../utils/route-optimizer.js';
import { getIO } from '../index.js';

const router = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_STATUSES = ['planned', 'in_progress', 'completed', 'cancelled'];

// GET /api/tours
router.get('/', authenticate, async (req, res) => {
  try {
    const { status } = req.query;
    let query = `SELECT t.*, u.first_name as driver_first_name, u.last_name as driver_last_name,
       (SELECT COUNT(*) FROM orders WHERE tour_id = t.id) as order_count
       FROM tours t JOIN users u ON u.id = t.driver_id
       WHERE t.business_id = $1`;
    const params = [req.user.businessId];

    if (status) {
      if (!VALID_STATUSES.includes(status)) return res.status(400).json({ error: 'Statut invalide' });
      query += ' AND t.status = $2';
      params.push(status);
    }

    query += ' ORDER BY t.created_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('List tours error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des tournées' });
  }
});

// GET /api/tours/:id
router.get('/:id', authenticate, async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'ID invalide' });

  try {
    const tour = await pool.query(
      `SELECT t.*, u.first_name as driver_first_name, u.last_name as driver_last_name
       FROM tours t JOIN users u ON u.id = t.driver_id
       WHERE t.id = $1 AND t.business_id = $2`,
      [req.params.id, req.user.businessId]
    );
    if (!tour.rows.length) return res.status(404).json({ error: 'Tournée non trouvée' });

    const orders = await pool.query(
      `SELECT o.id, o.order_number, o.customer_name, o.customer_phone, o.delivery_address,
              o.delivery_latitude, o.delivery_longitude, o.status, o.stop_order, o.total
       FROM orders o WHERE o.tour_id = $1 ORDER BY o.stop_order`,
      [req.params.id]
    );

    res.json({ ...tour.rows[0], orders: orders.rows });
  } catch (err) {
    console.error('Get tour error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération de la tournée' });
  }
});

// POST /api/tours
router.post('/', authenticate, requireRole('manager'), async (req, res) => {
  const { driverId, name, orderIds, startLatitude, startLongitude } = req.body;

  if (!driverId || !UUID_RE.test(driverId)) return res.status(400).json({ error: 'ID livreur invalide' });
  if (!Array.isArray(orderIds) || orderIds.length === 0) return res.status(400).json({ error: 'Au moins une commande requise' });

  for (const id of orderIds) {
    if (!UUID_RE.test(id)) return res.status(400).json({ error: `ID commande invalide: ${id}` });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const driver = await client.query(
      'SELECT id FROM users WHERE id = $1 AND business_id = $2 AND role IN (\'driver\', \'manager_driver\') AND is_active = true',
      [driverId, req.user.businessId]
    );
    if (!driver.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Livreur non trouvé ou inactif' });
    }

    const tourResult = await client.query(
      `INSERT INTO tours (business_id, driver_id, name, start_latitude, start_longitude)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.user.businessId, driverId, name?.trim() || `Tournée ${new Date().toLocaleDateString('fr-FR')}`,
       startLatitude || null, startLongitude || null]
    );
    const tourId = tourResult.rows[0].id;

    const orders = await client.query(
      'SELECT id, delivery_latitude, delivery_longitude FROM orders WHERE id = ANY($1) AND business_id = $2',
      [orderIds, req.user.businessId]
    );

    if (orders.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Aucune commande valide trouvée' });
    }

    let stopOrder;
    if (startLatitude && startLongitude) {
      const start = { lat: parseFloat(startLatitude), lng: parseFloat(startLongitude) };
      const geoOrders = orders.rows.filter(o => o.delivery_latitude && o.delivery_longitude);
      const nonGeoOrders = orders.rows.filter(o => !o.delivery_latitude || !o.delivery_longitude);

      if (geoOrders.length > 0) {
        const stops = geoOrders.map(o => ({ lat: o.delivery_latitude, lng: o.delivery_longitude, id: o.id }));
        const optimizedIndices = optimizeRoute(start, stops);
        stopOrder = optimizedIndices.map((idx, pos) => ({ id: stops[idx].id, order: pos + 1 }));

        let pos = stopOrder.length + 1;
        for (const o of nonGeoOrders) {
          stopOrder.push({ id: o.id, order: pos++ });
        }
      }
    }

    if (!stopOrder) {
      stopOrder = orders.rows.map((o, i) => ({ id: o.id, order: i + 1 }));
    }

    for (const s of stopOrder) {
      await client.query(
        `UPDATE orders SET tour_id = $1, stop_order = $2, driver_id = $3,
         status = CASE WHEN status = 'pending' THEN 'confirmed' ELSE status END,
         updated_at = NOW() WHERE id = $4`,
        [tourId, s.order, driverId, s.id]
      );
      await client.query(
        `INSERT INTO order_status_history (order_id, status, note, changed_by)
         SELECT $1, 'confirmed', 'Assignée à une tournée', $2
         WHERE EXISTS (SELECT 1 FROM orders WHERE id = $1 AND status = 'confirmed')`,
        [s.id, req.user.id]
      );
    }

    await client.query(
      'UPDATE tours SET optimized_route = $1 WHERE id = $2',
      [JSON.stringify(stopOrder), tourId]
    );

    await client.query('COMMIT');

    try {
      const io = getIO();
      if (io) {
        io.to(`business:${req.user.businessId}`).emit('tour:created', {
          tourId, name: tourResult.rows[0].name, driverId, stopCount: stopOrder.length,
        });
      }
    } catch {}

    res.status(201).json({ ...tourResult.rows[0], stops: stopOrder });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Create tour error:', err);
    res.status(500).json({ error: 'Erreur lors de la création de la tournée' });
  } finally {
    client.release();
  }
});

// PATCH /api/tours/:id/status
router.patch('/:id/status', authenticate, async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'ID invalide' });

  const { status } = req.body;
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Statut invalide. Choix: ${VALID_STATUSES.join(', ')}` });
  }

  try {
    const current = await pool.query(
      'SELECT status FROM tours WHERE id = $1 AND business_id = $2',
      [req.params.id, req.user.businessId]
    );
    if (!current.rows.length) return res.status(404).json({ error: 'Tournée non trouvée' });

    if (current.rows[0].status === 'completed') {
      return res.status(400).json({ error: 'Impossible de modifier une tournée terminée' });
    }

    let extra = '';
    if (status === 'in_progress') extra = ', started_at = NOW()';
    else if (status === 'completed') extra = ', completed_at = NOW()';

    const result = await pool.query(
      `UPDATE tours SET status = $1, updated_at = NOW() ${extra} WHERE id = $2 AND business_id = $3 RETURNING *`,
      [status, req.params.id, req.user.businessId]
    );

    try {
      const io = getIO();
      if (io) io.to(`business:${req.user.businessId}`).emit('tour:status', { tourId: req.params.id, status });
    } catch {}

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update tour status error:', err);
    res.status(500).json({ error: 'Erreur lors du changement de statut de la tournée' });
  }
});

// POST /api/tours/:id/optimize
router.post('/:id/optimize', authenticate, requireRole('manager'), async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'ID invalide' });

  try {
    const tour = await pool.query(
      'SELECT * FROM tours WHERE id = $1 AND business_id = $2',
      [req.params.id, req.user.businessId]
    );
    if (!tour.rows.length) return res.status(404).json({ error: 'Tournée non trouvée' });

    const t = tour.rows[0];
    if (!t.start_latitude || !t.start_longitude) {
      return res.status(400).json({ error: 'Position de départ requise pour l\'optimisation' });
    }
    if (t.status === 'completed') {
      return res.status(400).json({ error: 'Impossible d\'optimiser une tournée terminée' });
    }

    const orders = await pool.query(
      `SELECT id, delivery_latitude, delivery_longitude FROM orders
       WHERE tour_id = $1 AND delivery_latitude IS NOT NULL AND delivery_longitude IS NOT NULL`,
      [req.params.id]
    );

    if (orders.rows.length < 2) {
      return res.status(400).json({ error: 'Au moins 2 arrêts avec coordonnées GPS requis pour optimiser' });
    }

    const start = { lat: t.start_latitude, lng: t.start_longitude };
    const stops = orders.rows.map(o => ({ lat: o.delivery_latitude, lng: o.delivery_longitude, id: o.id }));
    const optimizedIndices = optimizeRoute(start, stops);
    const stopOrder = optimizedIndices.map((idx, pos) => ({ id: stops[idx].id, order: pos + 1 }));

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const s of stopOrder) {
        await client.query('UPDATE orders SET stop_order = $1, updated_at = NOW() WHERE id = $2', [s.order, s.id]);
      }
      await client.query(
        'UPDATE tours SET optimized_route = $1, updated_at = NOW() WHERE id = $2',
        [JSON.stringify(stopOrder), req.params.id]
      );
      await client.query('COMMIT');
      res.json({ stops: stopOrder, message: 'Itinéraire optimisé avec succès' });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Optimize tour error:', err);
    res.status(500).json({ error: 'Erreur lors de l\'optimisation de la tournée' });
  }
});

// DELETE /api/tours/:id
router.delete('/:id', authenticate, requireRole('manager'), async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'ID invalide' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const tour = await client.query(
      'SELECT status FROM tours WHERE id = $1 AND business_id = $2',
      [req.params.id, req.user.businessId]
    );
    if (!tour.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Tournée non trouvée' });
    }
    if (tour.rows[0].status === 'in_progress') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Impossible de supprimer une tournée en cours' });
    }

    await client.query(
      'UPDATE orders SET tour_id = NULL, stop_order = NULL, updated_at = NOW() WHERE tour_id = $1',
      [req.params.id]
    );
    await client.query('DELETE FROM tours WHERE id = $1', [req.params.id]);

    await client.query('COMMIT');
    res.json({ success: true, message: 'Tournée supprimée' });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Delete tour error:', err);
    res.status(500).json({ error: 'Erreur lors de la suppression de la tournée' });
  } finally {
    client.release();
  }
});

export default router;
