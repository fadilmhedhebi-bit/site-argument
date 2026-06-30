import { Router } from 'express';
import pool from '../config/db.js';
import { authenticate, authenticateOptional, requireRole } from '../middleware/auth.js';
import { generateOrderNumber } from '../utils/order-number.js';
import { getIO } from '../index.js';

const router = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function notifyBusiness(businessId, event, data) {
  try {
    const io = getIO();
    if (io) io.to(`business:${businessId}`).emit(event, data);
  } catch {}
}

// GET /api/orders - Liste des commandes (filtres: status, driverId, date)
router.get('/', authenticate, async (req, res) => {
  try {
    const { status, driverId, date, limit, offset } = req.query;
    let query = `SELECT o.*, u.first_name as driver_first_name, u.last_name as driver_last_name
                 FROM orders o LEFT JOIN users u ON u.id = o.driver_id
                 WHERE o.business_id = $1`;
    const params = [req.user.businessId];
    let idx = 2;

    if (status) {
      const validStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'in_delivery', 'delivered', 'problem', 'cancelled'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: `Statut invalide. Choix: ${validStatuses.join(', ')}` });
      }
      query += ` AND o.status = $${idx++}`;
      params.push(status);
    }
    if (driverId) {
      if (!UUID_RE.test(driverId)) return res.status(400).json({ error: 'Format driverId invalide' });
      query += ` AND o.driver_id = $${idx++}`;
      params.push(driverId);
    }
    if (date) {
      query += ` AND DATE(o.created_at) = $${idx++}`;
      params.push(date);
    }

    query += ' ORDER BY o.created_at DESC';

    const maxLimit = Math.min(parseInt(limit) || 100, 500);
    const pageOffset = Math.max(parseInt(offset) || 0, 0);
    query += ` LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(maxLimit, pageOffset);

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('List orders error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des commandes' });
  }
});

// GET /api/orders/:id - Détail d'une commande avec items et historique
router.get('/:id', authenticate, async (req, res) => {
  if (!UUID_RE.test(req.params.id)) {
    return res.status(400).json({ error: 'Format d\'identifiant invalide' });
  }

  try {
    const order = await pool.query(
      `SELECT o.*, u.first_name as driver_first_name, u.last_name as driver_last_name
       FROM orders o LEFT JOIN users u ON u.id = o.driver_id
       WHERE o.id = $1 AND o.business_id = $2`,
      [req.params.id, req.user.businessId]
    );
    if (!order.rows.length) {
      return res.status(404).json({ error: 'Commande non trouvée' });
    }

    const [items, history] = await Promise.all([
      pool.query('SELECT * FROM order_items WHERE order_id = $1 ORDER BY id', [req.params.id]),
      pool.query(
        `SELECT h.*, u.first_name, u.last_name FROM order_status_history h
         LEFT JOIN users u ON u.id = h.changed_by WHERE h.order_id = $1 ORDER BY h.created_at`,
        [req.params.id]
      ),
    ]);

    res.json({ ...order.rows[0], items: items.rows, history: history.rows });
  } catch (err) {
    console.error('Get order error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération de la commande' });
  }
});

// POST /api/orders - Créer une commande (authentifié)
router.post('/', authenticate, async (req, res) => {
  const {
    customerName, customerPhone, customerEmail, deliveryAddress,
    deliveryLatitude, deliveryLongitude, deliveryNotes,
    paymentMethod, items, promoCode,
  } = req.body;

  if (!customerName?.trim()) return res.status(400).json({ error: 'Nom du client requis' });
  if (!customerPhone?.trim()) return res.status(400).json({ error: 'Téléphone du client requis' });
  if (!deliveryAddress?.trim()) return res.status(400).json({ error: 'Adresse de livraison requise' });
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'Au moins un article requis' });

  const validPayments = ['cash', 'card', 'meal_voucher'];
  if (paymentMethod && !validPayments.includes(paymentMethod)) {
    return res.status(400).json({ error: `Mode de paiement invalide. Choix: ${validPayments.join(', ')}` });
  }

  for (const item of items) {
    if (!item.productId || !UUID_RE.test(item.productId)) {
      return res.status(400).json({ error: 'productId invalide dans les articles' });
    }
    if (!Number.isInteger(item.quantity) || item.quantity < 1) {
      return res.status(400).json({ error: 'Quantité invalide (entier >= 1)' });
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let subtotal = 0;
    const orderItems = [];
    for (const item of items) {
      const prod = await client.query(
        'SELECT id, name, price, stock_quantity, is_available FROM products WHERE id = $1 AND business_id = $2',
        [item.productId, req.user.businessId]
      );
      if (!prod.rows.length) {
        throw new Error(`Produit ${item.productId} non trouvé dans votre catalogue`);
      }
      const p = prod.rows[0];
      if (!p.is_available) {
        throw new Error(`Le produit "${p.name}" n'est plus disponible`);
      }
      if (p.stock_quantity < item.quantity) {
        throw new Error(`Stock insuffisant pour "${p.name}" (disponible: ${p.stock_quantity}, demandé: ${item.quantity})`);
      }
      const totalPrice = parseFloat(p.price) * item.quantity;
      subtotal += totalPrice;
      orderItems.push({ productId: p.id, productName: p.name, quantity: item.quantity, unitPrice: parseFloat(p.price), totalPrice, notes: item.notes });
      await client.query('UPDATE products SET stock_quantity = stock_quantity - $1, updated_at = NOW() WHERE id = $2', [item.quantity, p.id]);
    }

    let discountAmount = 0;
    let promoCodeId = null;
    const deliveryFee = 2.50;

    if (promoCode) {
      const discount = await applyPromoCode(client, promoCode, req.user.businessId, subtotal, deliveryFee);
      discountAmount = discount.amount;
      promoCodeId = discount.promoCodeId;
    }

    const total = Math.max(0, subtotal + deliveryFee - discountAmount);
    const orderNumber = await generateOrderNumber();

    const orderResult = await client.query(
      `INSERT INTO orders (business_id, order_number, customer_name, customer_phone, customer_email,
       delivery_address, delivery_latitude, delivery_longitude, delivery_notes,
       subtotal, delivery_fee, discount_amount, total, payment_method, promo_code_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [req.user.businessId, orderNumber, customerName.trim(), customerPhone.trim(), customerEmail?.trim() || null,
       deliveryAddress.trim(), deliveryLatitude || null, deliveryLongitude || null, deliveryNotes?.trim() || null,
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

    const order = orderResult.rows[0];
    notifyBusiness(req.user.businessId, 'order:new', { orderNumber: order.order_number, customerName: order.customer_name, total: order.total });

    res.status(201).json(order);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Create order error:', err);
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

// POST /api/orders/public/:businessId - Commande publique (sans auth)
router.post('/public/:businessId', async (req, res) => {
  const {
    customerName, customerPhone, customerEmail, deliveryAddress,
    deliveryLatitude, deliveryLongitude, deliveryNotes,
    paymentMethod, items, promoCode,
  } = req.body;

  if (!UUID_RE.test(req.params.businessId)) return res.status(400).json({ error: 'Business ID invalide' });
  if (!customerName?.trim()) return res.status(400).json({ error: 'Nom requis' });
  if (!customerPhone?.trim()) return res.status(400).json({ error: 'Téléphone requis' });
  if (!deliveryAddress?.trim()) return res.status(400).json({ error: 'Adresse de livraison requise' });
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'Panier vide' });

  const businessId = req.params.businessId;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const bizCheck = await client.query('SELECT id FROM businesses WHERE id = $1', [businessId]);
    if (!bizCheck.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Commerce non trouvé' });
    }

    let subtotal = 0;
    const orderItems = [];
    for (const item of items) {
      if (!item.productId || !UUID_RE.test(item.productId)) throw new Error('Article invalide');
      if (!Number.isInteger(item.quantity) || item.quantity < 1) throw new Error('Quantité invalide');

      const prod = await client.query(
        'SELECT id, name, price, stock_quantity FROM products WHERE id = $1 AND business_id = $2 AND is_available = true',
        [item.productId, businessId]
      );
      if (!prod.rows.length) throw new Error('Produit non disponible');
      const p = prod.rows[0];
      if (p.stock_quantity < item.quantity) throw new Error(`Stock insuffisant pour ${p.name}`);
      const totalPrice = parseFloat(p.price) * item.quantity;
      subtotal += totalPrice;
      orderItems.push({ productId: p.id, productName: p.name, quantity: item.quantity, unitPrice: parseFloat(p.price), totalPrice, notes: item.notes });
      await client.query('UPDATE products SET stock_quantity = stock_quantity - $1, updated_at = NOW() WHERE id = $2', [item.quantity, p.id]);
    }

    let discountAmount = 0;
    let promoCodeId = null;
    const deliveryFee = 2.50;

    if (promoCode) {
      const discount = await applyPromoCode(client, promoCode, businessId, subtotal, deliveryFee);
      discountAmount = discount.amount;
      promoCodeId = discount.promoCodeId;
    }

    const total = Math.max(0, subtotal + deliveryFee - discountAmount);
    const orderNumber = await generateOrderNumber();

    const orderResult = await client.query(
      `INSERT INTO orders (business_id, order_number, customer_name, customer_phone, customer_email,
       delivery_address, delivery_latitude, delivery_longitude, delivery_notes,
       subtotal, delivery_fee, discount_amount, total, payment_method, promo_code_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [businessId, orderNumber, customerName.trim(), customerPhone.trim(), customerEmail?.trim() || null,
       deliveryAddress.trim(), deliveryLatitude || null, deliveryLongitude || null, deliveryNotes?.trim() || null,
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

    notifyBusiness(businessId, 'order:new', { orderNumber: orderResult.rows[0].order_number, customerName: customerName.trim(), total });

    res.status(201).json({ orderNumber: orderResult.rows[0].order_number, total: orderResult.rows[0].total });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Public order error:', err);
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

// GET /api/orders/track/:orderNumber - Suivi public par numéro CMD-XXXX
router.get('/track/:orderNumber', async (req, res) => {
  const { orderNumber } = req.params;
  if (!/^CMD-\d{4,}$/.test(orderNumber)) {
    return res.status(400).json({ error: 'Format de numéro invalide (ex: CMD-1001)' });
  }

  try {
    const order = await pool.query(
      `SELECT o.order_number, o.status, o.customer_name, o.delivery_address, o.total,
              o.subtotal, o.delivery_fee, o.discount_amount,
              o.payment_method, o.estimated_delivery_at, o.delivered_at, o.created_at,
              u.first_name as driver_first_name, u.last_name as driver_last_name
       FROM orders o LEFT JOIN users u ON u.id = o.driver_id
       WHERE o.order_number = $1`,
      [orderNumber]
    );
    if (!order.rows.length) {
      return res.status(404).json({ error: 'Commande non trouvée' });
    }

    const [history, items] = await Promise.all([
      pool.query(
        'SELECT status, note, created_at FROM order_status_history WHERE order_id = (SELECT id FROM orders WHERE order_number = $1) ORDER BY created_at',
        [orderNumber]
      ),
      pool.query(
        'SELECT product_name, quantity, unit_price, total_price FROM order_items WHERE order_id = (SELECT id FROM orders WHERE order_number = $1)',
        [orderNumber]
      ),
    ]);

    res.json({ ...order.rows[0], items: items.rows, history: history.rows });
  } catch (err) {
    console.error('Track order error:', err);
    res.status(500).json({ error: 'Erreur lors du suivi de la commande' });
  }
});

// PATCH /api/orders/:id/status - Changer le statut
router.patch('/:id/status', authenticate, async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'ID invalide' });

  const { status, note } = req.body;
  const validStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'in_delivery', 'delivered', 'problem', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `Statut invalide. Choix: ${validStatuses.join(', ')}` });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const current = await client.query(
      'SELECT id, status, order_number, business_id FROM orders WHERE id = $1 AND business_id = $2',
      [req.params.id, req.user.businessId]
    );
    if (!current.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Commande non trouvée' });
    }

    const currentStatus = current.rows[0].status;
    if (['delivered', 'cancelled'].includes(currentStatus) && status !== 'problem') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Impossible de modifier une commande ${currentStatus === 'delivered' ? 'livrée' : 'annulée'}` });
    }

    let extraSql = '';
    if (status === 'delivered') extraSql = ', delivered_at = NOW(), payment_status = \'paid\'';
    if (status === 'cancelled' && currentStatus !== 'delivered') {
      // Restore stock on cancellation
      const orderItems = await client.query('SELECT product_id, quantity FROM order_items WHERE order_id = $1', [req.params.id]);
      for (const item of orderItems.rows) {
        if (item.product_id) {
          await client.query('UPDATE products SET stock_quantity = stock_quantity + $1, updated_at = NOW() WHERE id = $2', [item.quantity, item.product_id]);
        }
      }
    }

    const result = await client.query(
      `UPDATE orders SET status = $1, updated_at = NOW() ${extraSql} WHERE id = $2 RETURNING *`,
      [status, req.params.id]
    );

    await client.query(
      'INSERT INTO order_status_history (order_id, status, note, changed_by) VALUES ($1, $2, $3, $4)',
      [req.params.id, status, note?.trim() || null, req.user.id]
    );

    await client.query('COMMIT');

    notifyBusiness(req.user.businessId, 'order:status', {
      orderId: req.params.id,
      orderNumber: current.rows[0].order_number,
      status,
    });

    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Update status error:', err);
    res.status(500).json({ error: 'Erreur lors du changement de statut' });
  } finally {
    client.release();
  }
});

// PATCH /api/orders/:id/assign - Assigner un livreur
router.patch('/:id/assign', authenticate, requireRole('manager'), async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'ID commande invalide' });
  const { driverId } = req.body;
  if (!driverId || !UUID_RE.test(driverId)) return res.status(400).json({ error: 'ID livreur invalide' });

  try {
    const driver = await pool.query(
      'SELECT id, first_name, last_name FROM users WHERE id = $1 AND business_id = $2 AND role IN (\'driver\', \'manager_driver\') AND is_active = true',
      [driverId, req.user.businessId]
    );
    if (!driver.rows.length) {
      return res.status(404).json({ error: 'Livreur non trouvé ou inactif' });
    }

    const result = await pool.query(
      'UPDATE orders SET driver_id = $1, updated_at = NOW() WHERE id = $2 AND business_id = $3 RETURNING *',
      [driverId, req.params.id, req.user.businessId]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Commande non trouvée' });
    }

    const d = driver.rows[0];
    notifyBusiness(req.user.businessId, 'order:assigned', {
      orderId: req.params.id,
      orderNumber: result.rows[0].order_number,
      driverName: `${d.first_name} ${d.last_name}`,
    });

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Assign driver error:', err);
    res.status(500).json({ error: 'Erreur lors de l\'assignation du livreur' });
  }
});

// PUT /api/orders/:id - Modifier une commande (avant préparation)
router.put('/:id', authenticate, requireRole('manager'), async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'ID invalide' });

  const { customerName, customerPhone, customerEmail, deliveryAddress, deliveryLatitude, deliveryLongitude, deliveryNotes, paymentMethod } = req.body;

  try {
    const existing = await pool.query('SELECT status FROM orders WHERE id = $1 AND business_id = $2', [req.params.id, req.user.businessId]);
    if (!existing.rows.length) return res.status(404).json({ error: 'Commande non trouvée' });
    if (!['pending', 'confirmed'].includes(existing.rows[0].status)) {
      return res.status(400).json({ error: 'Modification impossible: commande déjà en préparation ou livrée' });
    }

    const result = await pool.query(
      `UPDATE orders SET customer_name = COALESCE($1, customer_name), customer_phone = COALESCE($2, customer_phone),
       customer_email = COALESCE($3, customer_email), delivery_address = COALESCE($4, delivery_address),
       delivery_latitude = COALESCE($5, delivery_latitude), delivery_longitude = COALESCE($6, delivery_longitude),
       delivery_notes = COALESCE($7, delivery_notes), payment_method = COALESCE($8, payment_method),
       updated_at = NOW() WHERE id = $9 RETURNING *`,
      [customerName, customerPhone, customerEmail, deliveryAddress, deliveryLatitude, deliveryLongitude, deliveryNotes, paymentMethod, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update order error:', err);
    res.status(500).json({ error: 'Erreur lors de la modification de la commande' });
  }
});

// DELETE /api/orders/:id - Supprimer une commande (pending uniquement)
router.delete('/:id', authenticate, requireRole('manager'), async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'ID invalide' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query('SELECT id, status FROM orders WHERE id = $1 AND business_id = $2', [req.params.id, req.user.businessId]);
    if (!existing.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Commande non trouvée' });
    }
    if (existing.rows[0].status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Seules les commandes en attente peuvent être supprimées' });
    }

    const orderItems = await client.query('SELECT product_id, quantity FROM order_items WHERE order_id = $1', [req.params.id]);
    for (const item of orderItems.rows) {
      if (item.product_id) {
        await client.query('UPDATE products SET stock_quantity = stock_quantity + $1, updated_at = NOW() WHERE id = $2', [item.quantity, item.product_id]);
      }
    }

    await client.query('DELETE FROM order_status_history WHERE order_id = $1', [req.params.id]);
    await client.query('DELETE FROM order_items WHERE order_id = $1', [req.params.id]);
    await client.query('DELETE FROM orders WHERE id = $1', [req.params.id]);

    await client.query('COMMIT');
    res.json({ success: true, message: 'Commande supprimée et stock restauré' });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Delete order error:', err);
    res.status(500).json({ error: 'Erreur lors de la suppression de la commande' });
  } finally {
    client.release();
  }
});

// Helper: apply promo code in transaction
async function applyPromoCode(client, code, businessId, subtotal, deliveryFee) {
  const promo = await client.query(
    `SELECT * FROM promo_codes WHERE code = $1 AND business_id = $2 AND is_active = true
     AND (starts_at IS NULL OR starts_at <= NOW()) AND (expires_at IS NULL OR expires_at > NOW())
     AND (max_uses IS NULL OR current_uses < max_uses)`,
    [code.toUpperCase(), businessId]
  );

  if (!promo.rows.length) return { amount: 0, promoCodeId: null };

  const p = promo.rows[0];
  if (subtotal < parseFloat(p.min_order_amount)) return { amount: 0, promoCodeId: null };

  let amount = 0;
  if (p.type === 'percentage') amount = subtotal * (parseFloat(p.value) / 100);
  else if (p.type === 'fixed') amount = Math.min(parseFloat(p.value), subtotal);
  else if (p.type === 'free_delivery') amount = deliveryFee;

  await client.query('UPDATE promo_codes SET current_uses = current_uses + 1 WHERE id = $1', [p.id]);

  return { amount, promoCodeId: p.id };
}

export default router;
