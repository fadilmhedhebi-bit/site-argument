import { Router } from 'express';
import pool from '../config/db.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { generateOrderNumber } from '../utils/order-number.js';

const router = Router();

router.get('/', authenticate, async (req, res) => {
  try {
    const { status, driverId, date } = req.query;
    let query = `SELECT o.*, u.first_name as driver_first_name, u.last_name as driver_last_name
                 FROM orders o LEFT JOIN users u ON u.id = o.driver_id
                 WHERE o.business_id = $1`;
    const params = [req.user.businessId];
    let idx = 2;

    if (status) { query += ` AND o.status = $${idx++}`; params.push(status); }
    if (driverId) { query += ` AND o.driver_id = $${idx++}`; params.push(driverId); }
    if (date) { query += ` AND DATE(o.created_at) = $${idx++}`; params.push(date); }

    query += ' ORDER BY o.created_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erreur' });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const order = await pool.query(
      `SELECT o.*, u.first_name as driver_first_name, u.last_name as driver_last_name
       FROM orders o LEFT JOIN users u ON u.id = o.driver_id WHERE o.id = $1 AND o.business_id = $2`,
      [req.params.id, req.user.businessId]
    );
    if (!order.rows.length) return res.status(404).json({ error: 'Commande non trouvée' });
    const items = await pool.query('SELECT * FROM order_items WHERE order_id = $1', [req.params.id]);
    const history = await pool.query(
      `SELECT h.*, u.first_name, u.last_name FROM order_status_history h
       LEFT JOIN users u ON u.id = h.changed_by WHERE h.order_id = $1 ORDER BY h.created_at`,
      [req.params.id]
    );
    res.json({ ...order.rows[0], items: items.rows, history: history.rows });
  } catch (err) {
    res.status(500).json({ error: 'Erreur' });
  }
});

router.post('/', authenticate, async (req, res) => {
  const {
    customerName, customerPhone, customerEmail, deliveryAddress,
    deliveryLatitude, deliveryLongitude, deliveryNotes,
    paymentMethod, items, promoCode,
  } = req.body;

  if (!customerName || !customerPhone || !deliveryAddress || !items?.length) {
    return res.status(400).json({ error: 'Champs obligatoires manquants' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let subtotal = 0;
    const orderItems = [];
    for (const item of items) {
      const prod = await client.query('SELECT id, name, price, stock_quantity FROM products WHERE id = $1 AND business_id = $2', [item.productId, req.user.businessId]);
      if (!prod.rows.length) throw new Error(`Produit ${item.productId} non trouvé`);
      const p = prod.rows[0];
      if (p.stock_quantity < item.quantity) throw new Error(`Stock insuffisant pour ${p.name}`);
      const totalPrice = p.price * item.quantity;
      subtotal += totalPrice;
      orderItems.push({ productId: p.id, productName: p.name, quantity: item.quantity, unitPrice: p.price, totalPrice, notes: item.notes });
      await client.query('UPDATE products SET stock_quantity = stock_quantity - $1 WHERE id = $2', [item.quantity, p.id]);
    }

    let discountAmount = 0;
    let promoCodeId = null;
    const deliveryFee = 2.50;

    if (promoCode) {
      const promo = await client.query(
        `SELECT * FROM promo_codes WHERE code = $1 AND business_id = $2 AND is_active = true
         AND (starts_at IS NULL OR starts_at <= NOW()) AND (expires_at IS NULL OR expires_at > NOW())
         AND (max_uses IS NULL OR current_uses < max_uses)`,
        [promoCode, req.user.businessId]
      );
      if (promo.rows.length) {
        const p = promo.rows[0];
        if (subtotal >= p.min_order_amount) {
          promoCodeId = p.id;
          if (p.type === 'percentage') discountAmount = subtotal * (p.value / 100);
          else if (p.type === 'fixed') discountAmount = Math.min(p.value, subtotal);
          else if (p.type === 'free_delivery') discountAmount = deliveryFee;
          await client.query('UPDATE promo_codes SET current_uses = current_uses + 1 WHERE id = $1', [p.id]);
        }
      }
    }

    const total = subtotal + deliveryFee - discountAmount;
    const orderNumber = await generateOrderNumber();

    const orderResult = await client.query(
      `INSERT INTO orders (business_id, order_number, customer_name, customer_phone, customer_email,
       delivery_address, delivery_latitude, delivery_longitude, delivery_notes,
       subtotal, delivery_fee, discount_amount, total, payment_method, promo_code_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [req.user.businessId, orderNumber, customerName, customerPhone, customerEmail || null,
       deliveryAddress, deliveryLatitude || null, deliveryLongitude || null, deliveryNotes || null,
       subtotal, deliveryFee, discountAmount, total, paymentMethod || 'cash', promoCodeId]
    );

    for (const item of orderItems) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, total_price, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [orderResult.rows[0].id, item.productId, item.productName, item.quantity, item.unitPrice, item.totalPrice, item.notes || null]
      );
    }

    await client.query(
      `INSERT INTO order_status_history (order_id, status, changed_by) VALUES ($1, 'pending', $2)`,
      [orderResult.rows[0].id, req.user.id]
    );

    await client.query('COMMIT');
    res.status(201).json(orderResult.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create order error:', err);
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Public order creation (no auth)
router.post('/public/:businessId', async (req, res) => {
  const {
    customerName, customerPhone, customerEmail, deliveryAddress,
    deliveryLatitude, deliveryLongitude, deliveryNotes,
    paymentMethod, items, promoCode,
  } = req.body;

  if (!customerName || !customerPhone || !deliveryAddress || !items?.length) {
    return res.status(400).json({ error: 'Champs obligatoires manquants' });
  }

  const businessId = req.params.businessId;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let subtotal = 0;
    const orderItems = [];
    for (const item of items) {
      const prod = await client.query('SELECT id, name, price, stock_quantity FROM products WHERE id = $1 AND business_id = $2 AND is_available = true', [item.productId, businessId]);
      if (!prod.rows.length) throw new Error(`Produit non disponible`);
      const p = prod.rows[0];
      if (p.stock_quantity < item.quantity) throw new Error(`Stock insuffisant pour ${p.name}`);
      const totalPrice = p.price * item.quantity;
      subtotal += totalPrice;
      orderItems.push({ productId: p.id, productName: p.name, quantity: item.quantity, unitPrice: p.price, totalPrice, notes: item.notes });
      await client.query('UPDATE products SET stock_quantity = stock_quantity - $1 WHERE id = $2', [item.quantity, p.id]);
    }

    let discountAmount = 0;
    let promoCodeId = null;
    const deliveryFee = 2.50;

    if (promoCode) {
      const promo = await client.query(
        `SELECT * FROM promo_codes WHERE code = $1 AND business_id = $2 AND is_active = true
         AND (starts_at IS NULL OR starts_at <= NOW()) AND (expires_at IS NULL OR expires_at > NOW())
         AND (max_uses IS NULL OR current_uses < max_uses)`,
        [promoCode, businessId]
      );
      if (promo.rows.length) {
        const p = promo.rows[0];
        if (subtotal >= p.min_order_amount) {
          promoCodeId = p.id;
          if (p.type === 'percentage') discountAmount = subtotal * (p.value / 100);
          else if (p.type === 'fixed') discountAmount = Math.min(p.value, subtotal);
          else if (p.type === 'free_delivery') discountAmount = deliveryFee;
          await client.query('UPDATE promo_codes SET current_uses = current_uses + 1 WHERE id = $1', [p.id]);
        }
      }
    }

    const total = subtotal + deliveryFee - discountAmount;
    const orderNumber = await generateOrderNumber();

    const orderResult = await client.query(
      `INSERT INTO orders (business_id, order_number, customer_name, customer_phone, customer_email,
       delivery_address, delivery_latitude, delivery_longitude, delivery_notes,
       subtotal, delivery_fee, discount_amount, total, payment_method, promo_code_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [businessId, orderNumber, customerName, customerPhone, customerEmail || null,
       deliveryAddress, deliveryLatitude || null, deliveryLongitude || null, deliveryNotes || null,
       subtotal, deliveryFee, discountAmount, total, paymentMethod || 'cash', promoCodeId]
    );

    for (const item of orderItems) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, total_price, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [orderResult.rows[0].id, item.productId, item.productName, item.quantity, item.unitPrice, item.totalPrice, item.notes || null]
      );
    }

    await client.query(
      `INSERT INTO order_status_history (order_id, status) VALUES ($1, 'pending')`,
      [orderResult.rows[0].id]
    );

    await client.query('COMMIT');
    res.status(201).json({ orderNumber: orderResult.rows[0].order_number, total: orderResult.rows[0].total });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Public tracking
router.get('/track/:orderNumber', async (req, res) => {
  try {
    const order = await pool.query(
      `SELECT o.order_number, o.status, o.customer_name, o.delivery_address, o.total,
              o.payment_method, o.estimated_delivery_at, o.delivered_at, o.created_at,
              u.first_name as driver_first_name
       FROM orders o LEFT JOIN users u ON u.id = o.driver_id
       WHERE o.order_number = $1`,
      [req.params.orderNumber]
    );
    if (!order.rows.length) return res.status(404).json({ error: 'Commande non trouvée' });

    const history = await pool.query(
      'SELECT status, note, created_at FROM order_status_history WHERE order_id = (SELECT id FROM orders WHERE order_number = $1) ORDER BY created_at',
      [req.params.orderNumber]
    );
    const items = await pool.query(
      'SELECT product_name, quantity, unit_price, total_price FROM order_items WHERE order_id = (SELECT id FROM orders WHERE order_number = $1)',
      [req.params.orderNumber]
    );
    res.json({ ...order.rows[0], items: items.rows, history: history.rows });
  } catch (err) {
    res.status(500).json({ error: 'Erreur' });
  }
});

router.patch('/:id/status', authenticate, async (req, res) => {
  const { status, note } = req.body;
  const validStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'in_delivery', 'delivered', 'problem', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Statut invalide' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const extra = status === 'delivered' ? ', delivered_at = NOW(), payment_status = \'paid\'' : '';
    const result = await client.query(
      `UPDATE orders SET status = $1, updated_at = NOW() ${extra} WHERE id = $2 AND business_id = $3 RETURNING *`,
      [status, req.params.id, req.user.businessId]
    );
    if (!result.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Commande non trouvée' }); }

    await client.query(
      'INSERT INTO order_status_history (order_id, status, note, changed_by) VALUES ($1, $2, $3, $4)',
      [req.params.id, status, note || null, req.user.id]
    );
    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Erreur' });
  } finally {
    client.release();
  }
});

router.patch('/:id/assign', authenticate, requireRole('manager'), async (req, res) => {
  const { driverId } = req.body;
  try {
    const result = await pool.query(
      'UPDATE orders SET driver_id = $1, updated_at = NOW() WHERE id = $2 AND business_id = $3 RETURNING *',
      [driverId, req.params.id, req.user.businessId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Commande non trouvée' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erreur' });
  }
});

export default router;
