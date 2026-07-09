import { Router } from 'express';
import pool from '../config/db.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { sendReservationSMS } from '../utils/sms.js';

const router = Router();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

router.get('/', authenticate, async (req, res) => {
  try {
    const { date, status } = req.query;
    let query = `SELECT r.*, rt.table_number FROM reservations r
      LEFT JOIN restaurant_tables rt ON rt.id = r.table_id
      WHERE r.business_id = $1`;
    const params = [req.user.businessId];
    let idx = 2;

    if (date) {
      query += ` AND r.reservation_date = $${idx++}`;
      params.push(date);
    }
    if (status) {
      query += ` AND r.status = $${idx++}`;
      params.push(status);
    }

    query += ' ORDER BY r.reservation_date, r.reservation_time';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('List reservations error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des réservations' });
  }
});

router.post('/', authenticate, requireRole('manager'), async (req, res) => {
  const { customerLastName, customerFirstName, customerPhone, reservationDate, reservationTime, partySize, tableId, notes } = req.body;

  if (!customerLastName?.trim()) return res.status(400).json({ error: 'Nom requis' });
  if (!customerFirstName?.trim()) return res.status(400).json({ error: 'Prénom requis' });
  if (!customerPhone?.trim()) return res.status(400).json({ error: 'Téléphone requis' });
  if (!reservationDate) return res.status(400).json({ error: 'Date requise' });
  if (!reservationTime) return res.status(400).json({ error: 'Heure requise' });
  if (!partySize || parseInt(partySize) < 1) return res.status(400).json({ error: 'Nombre de personnes invalide' });

  try {
    const numResult = await pool.query("SELECT nextval('reservation_number_seq')");
    const reservationNumber = `R${numResult.rows[0].nextval}`;

    if (tableId) {
      if (!UUID_RE.test(tableId)) return res.status(400).json({ error: 'ID de table invalide' });
      await pool.query(
        'UPDATE restaurant_tables SET status = $1, updated_at = NOW() WHERE id = $2 AND business_id = $3',
        ['reserved', tableId, req.user.businessId]
      );
    }

    const result = await pool.query(
      `INSERT INTO reservations (business_id, reservation_number, table_id, customer_last_name, customer_first_name,
       customer_phone, reservation_date, reservation_time, party_size, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [req.user.businessId, reservationNumber, tableId || null,
       customerLastName.trim(), customerFirstName.trim(), customerPhone.trim(),
       reservationDate, reservationTime, parseInt(partySize), notes?.trim() || null]
    );

    const reservation = result.rows[0];

    const biz = await pool.query('SELECT name, address, phone FROM businesses WHERE id = $1', [req.user.businessId]);
    try {
      await sendReservationSMS(customerPhone.trim(), reservation, biz.rows[0] || {});
    } catch (smsErr) {
      console.error('SMS send error:', smsErr);
    }

    res.status(201).json(reservation);
  } catch (err) {
    console.error('Create reservation error:', err);
    res.status(500).json({ error: 'Erreur lors de la création de la réservation' });
  }
});

router.patch('/:id/status', authenticate, async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'ID invalide' });
  const { status } = req.body;
  if (!['confirmed', 'cancelled', 'completed', 'no_show'].includes(status)) {
    return res.status(400).json({ error: 'Statut invalide' });
  }
  try {
    const result = await pool.query(
      'UPDATE reservations SET status = $1, updated_at = NOW() WHERE id = $2 AND business_id = $3 RETURNING *',
      [status, req.params.id, req.user.businessId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Réservation non trouvée' });

    if (['cancelled', 'completed', 'no_show'].includes(status) && result.rows[0].table_id) {
      await pool.query(
        'UPDATE restaurant_tables SET status = $1, updated_at = NOW() WHERE id = $2',
        ['available', result.rows[0].table_id]
      );
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update reservation status error:', err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du statut' });
  }
});

router.delete('/:id', authenticate, requireRole('manager'), async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'ID invalide' });
  try {
    const reservation = await pool.query(
      'DELETE FROM reservations WHERE id = $1 AND business_id = $2 RETURNING *',
      [req.params.id, req.user.businessId]
    );
    if (!reservation.rows.length) return res.status(404).json({ error: 'Réservation non trouvée' });

    if (reservation.rows[0].table_id) {
      await pool.query(
        'UPDATE restaurant_tables SET status = $1, updated_at = NOW() WHERE id = $2',
        ['available', reservation.rows[0].table_id]
      );
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Delete reservation error:', err);
    res.status(500).json({ error: 'Erreur lors de la suppression de la réservation' });
  }
});

router.get('/public/:reservationNumber', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.reservation_number, r.customer_last_name, r.customer_first_name,
       r.reservation_date, r.reservation_time, r.party_size, r.status,
       b.name as business_name, b.address as business_address, b.phone as business_phone,
       b.logo_url, b.primary_color, b.secondary_color
       FROM reservations r
       JOIN businesses b ON b.id = r.business_id
       WHERE r.reservation_number = $1`,
      [req.params.reservationNumber]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Réservation non trouvée' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Public reservation error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération de la réservation' });
  }
});

export default router;
