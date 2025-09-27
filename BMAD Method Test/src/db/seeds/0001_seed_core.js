/**
 * Seed core dimension data: customers, products
 */

/** @param {import('knex').Knex} knex */
exports.seed = async function (knex) {
  // Clear in FK order
  await knex('order_items').del().catch(() => {});
  await knex('orders').del().catch(() => {});
  await knex('products').del().catch(() => {});
  await knex('customers').del().catch(() => {});

  const cities = [
    'San Francisco',
    'New York',
    'Seattle',
    'Austin',
    'Chicago',
    'London',
    'Paris',
    'Berlin',
    'Barcelona',
    'Zurich',
    'Dublin',
    'Amsterdam',
  ];

  const categories = ['Accessories', 'Electronics', 'Apparel', 'Home'];

  // 50 customers (include Alice explicitly)
  const customers = [];
  customers.push({ id: 1, name: 'Alice', city: pick(cities) });
  for (let i = 2; i <= 50; i++) {
    customers.push({
      id: i,
      name: randomName(i),
      city: pick(cities),
    });
  }

  // 50 products
  const products = [];
  for (let i = 1; i <= 50; i++) {
    const category = pick(categories);
    products.push({
      id: i,
      name: `${category} Item ${i}`,
      category,
      price: randomPrice(5, 500),
    });
  }

  await knex.batchInsert('customers', customers, 50);
  await knex.batchInsert('products', products, 50);
};

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomName(i) {
  const first = [
    'Bob',
    'Carol',
    'Dave',
    'Eve',
    'Frank',
    'Grace',
    'Heidi',
    'Ivan',
    'Judy',
    'Mallory',
    'Niaj',
    'Olivia',
    'Peggy',
    'Rupert',
    'Sybil',
    'Trent',
    'Victor',
    'Walter',
    'Yvonne',
    'Zara',
  ];
  const last = [
    'Smith',
    'Johnson',
    'Williams',
    'Brown',
    'Jones',
    'Miller',
    'Davis',
    'Garcia',
    'Rodriguez',
    'Wilson',
    'Martinez',
    'Anderson',
    'Taylor',
    'Thomas',
    'Hernandez',
  ];
  const f = first[(i + 3) % first.length];
  const l = last[(i * 7) % last.length];
  return `${f} ${l}`;
}

function randomPrice(min, max) {
  const value = Math.random() * (max - min) + min;
  return Math.round(value * 100) / 100;
}
