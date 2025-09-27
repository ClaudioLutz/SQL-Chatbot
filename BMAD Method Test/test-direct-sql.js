/**
 * Test the generated SQL queries directly with manual parameters to verify they work
 */

const knex = require('knex');

const db = knex({
  client: 'sqlite3',
  connection: {
    filename: './db.sqlite',
  },
  useNullAsDefault: true,
});

async function testDirectSQL() {
  console.log('🔍 Testing SQL queries directly...\n');
  
  try {
    // Test 1: Alice's 2024 orders (this should work based on our database check)
    console.log('=== Query 3: Alice 2024 orders (direct SQL) ===');
    const alice2024Direct = await db.raw(`
      SELECT COUNT(*) AS cnt
      FROM orders o
      JOIN customers c ON c.id = o.customer_id
      WHERE c.name = ?
      AND o.order_date >= ?
      AND o.order_date < ?
      LIMIT 100
    `, ['Alice', '2024-01-01', '2025-01-01']);
    
    const result1 = alice2024Direct[0] || alice2024Direct;
    console.log('✅ Direct SQL result:', result1);

    // Test 2: Products in Accessories with avg qty > 2
    console.log('\n=== Query 2: Accessories products (direct SQL) ===');
    const accessoriesResult = await db.raw(`
      SELECT p.id, p.name, p.category, AVG(oi.quantity) AS avg_quantity
      FROM products p 
      JOIN order_items oi ON oi.product_id = p.id
      WHERE p.category = ?
      GROUP BY p.id, p.name, p.category
      HAVING AVG(oi.quantity) > ?
      ORDER BY avg_quantity DESC
      LIMIT 100
    `, ['Accessories', 2]);
    
    const result2 = accessoriesResult[0] || accessoriesResult;
    console.log(`✅ Direct SQL result: ${Array.isArray(result2) ? result2.length : 0} rows`);
    if (Array.isArray(result2) && result2.length > 0) {
      console.log('Sample:', result2[0]);
    }

    // Test 3: Last quarter revenue by city 
    // Calculate last quarter dates
    const now = new Date();
    const month = now.getUTCMonth(); // 0..11
    const year = now.getUTCFullYear();
    const currentQuarter = Math.floor(month / 3) + 1; // 1..4
    let q = currentQuarter - 1;
    let y = year;
    if (q < 1) {
      q = 4;
      y = year - 1;
    }
    const startMonth = (q - 1) * 3; // 0,3,6,9
    const qStart = new Date(Date.UTC(y, startMonth, 1));
    const nextQStart = new Date(Date.UTC(y, startMonth + 3, 1));
    const qEnd = new Date(nextQStart.getTime() - 24 * 60 * 60 * 1000);
    
    const qStartStr = qStart.toISOString().split('T')[0];
    const qEndStr = qEnd.toISOString().split('T')[0];
    
    console.log(`\n=== Query 1: Last quarter (${qStartStr} to ${qEndStr}) city revenue ===`);
    
    const lastQuarterResult = await db.raw(`
      WITH revenue_by_city AS (
        SELECT c.city AS city, SUM(o.total) AS revenue
        FROM orders o
        JOIN customers c ON c.id = o.customer_id
        WHERE o.order_date >= ? AND o.order_date <= ?
        GROUP BY c.city
      )
      SELECT city, revenue
      FROM revenue_by_city
      ORDER BY revenue DESC
      LIMIT 5
    `, [qStartStr, qEndStr]);
    
    const result3 = lastQuarterResult[0] || lastQuarterResult;
    console.log(`✅ Direct SQL result: ${Array.isArray(result3) ? result3.length : 0} rows`);
    if (Array.isArray(result3) && result3.length > 0) {
      console.log('Top cities:', result3);
    }

    // Test 4: Most expensive products with avg quantity
    console.log('\n=== Query 4: Most expensive products ===');
    const expensiveResult = await db.raw(`
      SELECT p.id, p.name, p.price, AVG(oi.quantity) AS avg_quantity_per_order
      FROM products p
      LEFT JOIN order_items oi ON oi.product_id = p.id
      GROUP BY p.id, p.name, p.price
      ORDER BY p.price DESC
      LIMIT 10
    `);
    
    const result4 = expensiveResult[0] || expensiveResult;
    console.log(`✅ Direct SQL result: ${Array.isArray(result4) ? result4.length : 0} rows`);
    if (Array.isArray(result4) && result4.length > 0) {
      console.log('Sample:', result4.slice(0, 2));
    }

  } catch (error) {
    console.error('❌ SQL error:', error.message);
  } finally {
    await db.destroy();
  }
}

testDirectSQL().catch(console.error);
