import bcrypt from 'bcrypt';
import pool from './db.js';

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Commerce
    const biz = await client.query(
      `INSERT INTO businesses (id, name, address, phone)
       VALUES ('00000000-0000-0000-0000-000000000001', 'Snack El Baraka', '12 Rue de la Paix, 75002 Paris', '01 23 45 67 89')
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`
    );
    const bizId = biz.rows[0].id;

    // 2. Gestionnaire (manager / mdp: admin123)
    const managerHash = await bcrypt.hash('admin123', 12);
    await client.query(
      `INSERT INTO users (id, business_id, username, password_hash, first_name, last_name, email, phone, role)
       VALUES ('00000000-0000-0000-0000-000000000010', $1, 'admin', $2, 'Fadil', 'Mhedhebi', 'fadil@snack.fr', '06 12 34 56 78', 'manager')
       ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash, first_name = EXCLUDED.first_name`,
      [bizId, managerHash]
    );

    // 3. Livreurs (mdp: livreur123)
    const driverHash = await bcrypt.hash('livreur123', 12);
    await client.query(
      `INSERT INTO users (id, business_id, username, password_hash, first_name, last_name, phone, role)
       VALUES ('00000000-0000-0000-0000-000000000020', $1, 'karim.b', $2, 'Karim', 'Benali', '06 11 22 33 44', 'driver')
       ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
      [bizId, driverHash]
    );
    await client.query(
      `INSERT INTO users (id, business_id, username, password_hash, first_name, last_name, phone, role)
       VALUES ('00000000-0000-0000-0000-000000000021', $1, 'sara.m', $2, 'Sara', 'Moussaoui', '06 55 66 77 88', 'driver')
       ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
      [bizId, driverHash]
    );

    // 4. Catégories
    const catSnack = await client.query(
      `INSERT INTO product_categories (id, business_id, name, sort_order)
       VALUES ('00000000-0000-0000-0000-000000000100', $1, 'Snacks', 1)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`, [bizId]
    );
    const catBoisson = await client.query(
      `INSERT INTO product_categories (id, business_id, name, sort_order)
       VALUES ('00000000-0000-0000-0000-000000000101', $1, 'Boissons', 2)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`, [bizId]
    );

    // 5. Produits
    const products = [
      { id: '00000000-0000-0000-0000-000000000200', name: 'Tacos XL', desc: 'Tacos viande hachee, frites, sauce fromagere', price: 8.50, cat: catSnack.rows[0].id, qty: 50 },
      { id: '00000000-0000-0000-0000-000000000201', name: 'Burger Classic', desc: 'Steak, salade, tomate, oignon, sauce maison', price: 7.00, cat: catSnack.rows[0].id, qty: 40 },
      { id: '00000000-0000-0000-0000-000000000202', name: 'Panini Poulet', desc: 'Poulet grille, crudites, sauce blanche', price: 6.00, cat: catSnack.rows[0].id, qty: 35 },
      { id: '00000000-0000-0000-0000-000000000203', name: 'Coca-Cola 33cl', desc: null, price: 2.00, cat: catBoisson.rows[0].id, qty: 100 },
      { id: '00000000-0000-0000-0000-000000000204', name: 'Jus d\'orange frais', desc: 'Presse minute', price: 3.50, cat: catBoisson.rows[0].id, qty: 20 },
    ];

    for (const p of products) {
      await client.query(
        `INSERT INTO products (id, business_id, category_id, name, description, price, stock_quantity, stock_alert_threshold, is_available)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 5, true)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, price = EXCLUDED.price, stock_quantity = EXCLUDED.stock_quantity`,
        [p.id, bizId, p.cat, p.name, p.desc, p.price, p.qty]
      );
    }

    // 6. Code promo
    await client.query(
      `INSERT INTO promo_codes (id, business_id, code, type, value, min_order_amount, max_uses, is_active)
       VALUES ('00000000-0000-0000-0000-000000000300', $1, 'BIENVENUE', 'percentage', 10, 10, 50, true)
       ON CONFLICT (id) DO UPDATE SET code = EXCLUDED.code`,
      [bizId]
    );

    // 7. Commandes
    const orderData = [
      { id: '00000000-0000-0000-0000-000000000400', num: 'CMD-1001', name: 'Ali Mansour', phone: '06 99 88 77 66', addr: '25 Avenue des Champs-Elysees, 75008 Paris', lat: 48.8698, lng: 2.3076, method: 'cash', status: 'confirmed', driver: '00000000-0000-0000-0000-000000000020', items: [{ p: 0, qty: 2 }, { p: 3, qty: 2 }] },
      { id: '00000000-0000-0000-0000-000000000401', num: 'CMD-1002', name: 'Nadia Khelifi', phone: '06 44 55 66 77', addr: '8 Rue du Faubourg Saint-Honore, 75008 Paris', lat: 48.8704, lng: 2.3148, method: 'card', status: 'preparing', driver: '00000000-0000-0000-0000-000000000020', items: [{ p: 1, qty: 1 }, { p: 4, qty: 1 }] },
      { id: '00000000-0000-0000-0000-000000000402', num: 'CMD-1003', name: 'Mehdi Rahal', phone: '06 33 22 11 00', addr: '15 Boulevard Haussmann, 75009 Paris', lat: 48.8738, lng: 2.3318, method: 'meal_voucher', status: 'pending', driver: null, items: [{ p: 2, qty: 1 }, { p: 3, qty: 1 }] },
    ];

    for (const o of orderData) {
      let subtotal = 0;
      const itemDetails = o.items.map(i => {
        const p = products[i.p];
        const tp = p.price * i.qty;
        subtotal += tp;
        return { prodId: p.id, prodName: p.name, qty: i.qty, unitPrice: p.price, totalPrice: tp };
      });
      const deliveryFee = 2.50;
      const total = subtotal + deliveryFee;

      await client.query(
        `INSERT INTO orders (id, business_id, order_number, driver_id, customer_name, customer_phone,
         delivery_address, delivery_latitude, delivery_longitude, subtotal, delivery_fee, discount_amount,
         total, payment_method, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,0,$12,$13,$14)
         ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status`,
        [o.id, bizId, o.num, o.driver, o.name, o.phone, o.addr, o.lat, o.lng, subtotal, deliveryFee, total, o.method, o.status]
      );

      for (const item of itemDetails) {
        await client.query(
          `INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, total_price)
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT DO NOTHING`,
          [o.id, item.prodId, item.prodName, item.qty, item.unitPrice, item.totalPrice]
        );
      }

      await client.query(
        `INSERT INTO order_status_history (order_id, status) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [o.id, 'pending']
      );
      if (o.status !== 'pending') {
        await client.query(
          `INSERT INTO order_status_history (order_id, status) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [o.id, o.status]
        );
      }
    }

    // Update sequence to avoid collisions
    await client.query("SELECT setval('order_number_seq', 1003, true)");

    await client.query('COMMIT');

    console.log('');
    console.log('=== Donnees de demonstration inserees ===');
    console.log('');
    console.log('Commerce : Snack El Baraka');
    console.log('');
    console.log('Comptes :');
    console.log('  Gestionnaire  admin / admin123');
    console.log('  Livreur 1     karim.b / livreur123');
    console.log('  Livreur 2     sara.m / livreur123');
    console.log('');
    console.log('Produits : 5 (3 snacks + 2 boissons)');
    console.log('Commandes : 3 (CMD-1001, CMD-1002, CMD-1003)');
    console.log('Code promo : BIENVENUE (10% a partir de 10 EUR)');
    console.log('');
    console.log(`Page client : http://localhost:5173/commander/${bizId}`);
    console.log('');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Seed error:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
