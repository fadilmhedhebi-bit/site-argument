import crypto from 'crypto';

// Loi anti-fraude TVA (article 286 I-3 bis du CGI) - conditions d'inalterabilite,
// de securisation, de conservation et d'archivage (ISCA) des logiciels de caisse.
// Chaque table fiscale (orders payes, cash_transactions, daily/period_closings)
// maintient sa propre chaine de hash: chaque enregistrement contient le hash du
// precedent, ce qui rend toute alteration a posteriori detectable.

export const GENESIS_HASH = '0'.repeat(64);

export function sha256Hex(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

// Normalise un montant DECIMAL (string ou number) en representation fixe,
// pour que le hash calcule a l'ecriture et celui recalcule a la verification
// soient toujours identiques quel que soit le type renvoye par pg.
export function money(value) {
  return Number(value).toFixed(2);
}

export function computeHash(prevHash, sequenceNumber, payload) {
  const canonical = JSON.stringify(payload, Object.keys(payload).sort());
  return sha256Hex(`${prevHash}|${sequenceNumber}|${canonical}`);
}

// Serialise les acces concurrents a une meme chaine (table + business) pour
// eviter que deux ecritures simultanees ne calculent le meme sequence_number.
export async function lockChain(client, table, scopeId) {
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${table}:${scopeId}`]);
}

export async function nextLink(client, { table, whereSql, whereParams, sequenceCol = 'sequence_number', hashCol = 'hash' }) {
  const result = await client.query(
    `SELECT ${sequenceCol} as sequence_number, ${hashCol} as hash FROM ${table} WHERE ${whereSql} ORDER BY ${sequenceCol} DESC LIMIT 1`,
    whereParams
  );
  const last = result.rows[0];
  return {
    sequenceNumber: (last?.sequence_number ? Number(last.sequence_number) : 0) + 1,
    prevHash: last?.hash || GENESIS_HASH,
  };
}

// Rejoue une chaine et verifie que chaque prev_hash/hash est coherent.
export function verifyChain(entries) {
  let expectedPrev = GENESIS_HASH;
  for (const entry of entries) {
    if (entry.prevHash !== expectedPrev) {
      return { ok: false, brokenAt: entry.sequenceNumber, reason: 'prev_hash ne correspond pas au maillon precedent' };
    }
    const recomputed = computeHash(entry.prevHash, entry.sequenceNumber, entry.payload);
    if (recomputed !== entry.hash) {
      return { ok: false, brokenAt: entry.sequenceNumber, reason: 'hash incoherent avec les donnees enregistrees' };
    }
    expectedPrev = entry.hash;
  }
  return { ok: true };
}

// Constructeurs de payload partages entre l'ecriture (au moment de l'insertion)
// et la verification (relecture depuis la base) : les cles proviennent des
// memes noms de colonnes pg (snake_case) pour garantir un hash identique.

export function orderFiscalPayload({ id, order_number, business_id, subtotal, delivery_fee, discount_amount, total, payment_method }) {
  return {
    orderId: id,
    orderNumber: order_number,
    businessId: business_id,
    subtotal: money(subtotal),
    deliveryFee: money(delivery_fee),
    discountAmount: money(discount_amount),
    total: money(total),
    paymentMethod: payment_method,
  };
}

export function cashTxPayload({ business_id, session_id, type, payment_method, amount, label, order_id }) {
  return {
    businessId: business_id,
    sessionId: session_id,
    type,
    paymentMethod: payment_method,
    amount: money(amount),
    label: label || null,
    orderId: order_id || null,
  };
}

export function closingPayload({ business_id, closing_date, total_orders, total_delivered, total_cancelled, total_problems, revenue_cash, revenue_card, revenue_meal_voucher, revenue_total, total_discount, total_delivery_fees }) {
  return {
    businessId: business_id,
    closingDate: closing_date instanceof Date ? closing_date.toISOString().slice(0, 10) : closing_date,
    totalOrders: Number(total_orders),
    totalDelivered: Number(total_delivered),
    totalCancelled: Number(total_cancelled),
    totalProblems: Number(total_problems),
    revenueCash: money(revenue_cash),
    revenueCard: money(revenue_card),
    revenueMealVoucher: money(revenue_meal_voucher),
    revenueTotal: money(revenue_total),
    totalDiscount: money(total_discount),
    totalDeliveryFees: money(total_delivery_fees),
  };
}

export function periodClosingPayload({ business_id, period_type, period_key, total_orders, total_delivered, total_cancelled, total_problems, revenue_cash, revenue_card, revenue_meal_voucher, revenue_total, total_discount, total_delivery_fees }) {
  return {
    businessId: business_id,
    periodType: period_type,
    periodKey: period_key,
    totalOrders: Number(total_orders),
    totalDelivered: Number(total_delivered),
    totalCancelled: Number(total_cancelled),
    totalProblems: Number(total_problems),
    revenueCash: money(revenue_cash),
    revenueCard: money(revenue_card),
    revenueMealVoucher: money(revenue_meal_voucher),
    revenueTotal: money(revenue_total),
    totalDiscount: money(total_discount),
    totalDeliveryFees: money(total_delivery_fees),
  };
}
