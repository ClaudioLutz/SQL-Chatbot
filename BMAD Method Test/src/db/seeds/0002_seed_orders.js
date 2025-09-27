/**
 * Seed transactional data: orders (~200) and order_items
 * - Base random dates between 2023-01-01 and 2025-09-01 (UTC)
 * - Ensure last quarter coverage (UTC)
 * - Ensure Alice has orders in 2024
 * - Ensure a few recent orders (last 7 days)
 * - Each order has 1-5 items; unit_price = product price ±10% noise; total = SUM(quantity * unit_price)
 */

/** @param {import('knex').Knex} knex */
exports.seed = async function (knex) {
  // Ensure core tables exist
  const [hasCustomers, hasProducts] = await Promise.all([
    knex.schema.hasTable('customers'),
    knex.schema.hasTable('products'),
  ]);
  if (!hasCustomers || !hasProducts) {
    throw new Error('Core tables missing. Run migrations and seed core first.');
  }

  // Cleanup in FK order
  await knex('order_items').del().catch(() => {});
  await knex('orders').del().catch(() => {});

  const customers = await knex('customers').select('id', 'name');
  const products = await knex('products').select('id', 'price');

  const orders = [];
  const items = [];

  // Helpers to create an order with 1-5 items and computed total
  function createOrder(orderId, customerId, jsDate, productPicker = () => pick(products)) {
    const itemCount = randInt(1, 5);
    let total = 0;

    for (let j = 0; j < itemCount; j++) {
      const product = productPicker();
      const quantity = randInt(1, 5);
      const base = Number(product.price);
      const unit_price = round2(applyNoise(base, 0.1)); // ±10%
      const line_total = unit_price * quantity;
      total += line_total;

      items.push({
        id: items.length + 1,
        order_id: orderId,
        product_id: product.id,
        quantity,
        unit_price,
      });
    }

    orders.push({
      id: orderId,
      customer_id: customerId,
      order_date: toDateOnly(jsDate),
      total: round2(total),
    });
  }

  // Utility: compute last quarter (UTC)
  function getLastQuarterRangeUTC(refDate = new Date()) {
    const month = refDate.getUTCMonth(); // 0..11
    const year = refDate.getUTCFullYear();
    const currentQuarter = Math.floor(month / 3) + 1; // 1..4
    let q = currentQuarter - 1;
    let y = year;
    if (q < 1) {
      q = 4;
      y = year - 1;
    }
    const startMonth = (q - 1) * 3; // 0,3,6,9
    const start = new Date(Date.UTC(y, startMonth, 1));
    // End = last day of quarter (inclusive)
    const nextQStart = new Date(Date.UTC(y, startMonth + 3, 1));
    const end = new Date(nextQStart.getTime() - 24 * 60 * 60 * 1000);
    return { start, end, year: y, quarter: q };
  }

  const now = new Date();
  const baseStart = new Date('2023-01-01T00:00:00Z');
  const baseEnd = new Date('2025-09-01T00:00:00Z');
  const { start: qStart, end: qEnd } = getLastQuarterRangeUTC(now);
  const last7Start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 6)); // inclusive

  // 1) Base random population across 2023-01-01..2025-09-01 (UTC)
  const BASE_N = 160;
  let nextOrderId = 1;
  for (let i = 0; i < BASE_N; i++) {
    const customer = pick(customers);
    const date = randomDateUTC(baseStart, baseEnd);
    createOrder(nextOrderId++, customer.id, date);
  }

  // 2) Ensure robust coverage for "last quarter" (UTC)
  const LAST_Q_N = 24;
  for (let i = 0; i < LAST_Q_N; i++) {
    const customer = pick(customers);
    const date = randomDateUTC(qStart, qEnd);
    createOrder(nextOrderId++, customer.id, date);
  }

  // 3) Ensure Alice has some orders in 2024
  const alice = customers.find((c) => c.name === 'Alice') || customers[0];
  if (alice) {
    const aliceStart = new Date(Date.UTC(2024, 0, 1));
    const aliceEnd = new Date(Date.UTC(2024, 11, 31));
    const ALICE_2024_N = 5;
    for (let i = 0; i < ALICE_2024_N; i++) {
      const date = randomDateUTC(aliceStart, aliceEnd);
      createOrder(nextOrderId++, alice.id, date);
    }
  }

  // 4) Ensure a few recent orders in the last 7 days (UTC)
  const RECENT_N = 10;
  for (let i = 0; i < RECENT_N; i++) {
    const customer = pick(customers);
    const date = randomDateUTC(last7Start, now);
    createOrder(nextOrderId++, customer.id, date);
  }

  // Persist
  await knex.batchInsert('orders', orders, 50);
  await knex.batchInsert('order_items', items, 100);
};

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function applyNoise(value, pct) {
  const delta = (Math.random() * 2 - 1) * pct * value;
  return value + delta;
}
function round2(n) {
  return Math.round(n * 100) / 100;
}
function randomDateUTC(start, end) {
  const t = start.getTime() + Math.random() * (end.getTime() - start.getTime());
  return new Date(t);
}
function toDateOnly(d) {
  // Return YYYY-MM-DD (UTC)
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
