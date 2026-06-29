import pool from '../config/db.js';

export async function generateOrderNumber() {
  const result = await pool.query("SELECT nextval('order_number_seq')");
  return `CMD-${String(result.rows[0].nextval).padStart(4, '0')}`;
}
