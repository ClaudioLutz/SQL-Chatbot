/**
 * Test script to verify the four acceptance queries return rows after seed fix
 */

const http = require('http');

// The four acceptance test queries from PRD
const queries = [
  "Top 5 cities by total order revenue last quarter",
  "Products in 'Accessories' with avg order qty > 2", 
  "How many orders did Alice place in 2024?",
  "10 most expensive products and their average quantity per order"
];

function makeRequest(question) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ question });
    
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/chat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve({ status: res.statusCode, result });
        } catch (e) {
          resolve({ status: res.statusCode, error: 'Invalid JSON', raw: data });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(postData);
    req.end();
  });
}

async function testQueries() {
  console.log('🔍 Testing four acceptance queries...\n');
  
  for (let i = 0; i < queries.length; i++) {
    const question = queries[i];
    console.log(`\n=== Query ${i + 1}: ${question} ===`);
    
    try {
      const { status, result, error, raw } = await makeRequest(question);
      
      if (status !== 200) {
        console.log(`❌ HTTP ${status}`);
        if (error) console.log(`Error: ${error}`);
        if (raw) console.log(`Raw: ${raw}`);
        continue;
      }

      if (result.error) {
        console.log(`❌ API Error: ${result.error}`);
        continue;
      }

      console.log(`✅ Status: HTTP ${status}`);
      console.log(`📝 Answer: ${result.answer}`);
      console.log(`🔧 SQL: ${result.sql}`);
      console.log(`📊 Rows: ${result.rowsCount} rows returned`);
      console.log(`⏱️  Time: ${result.elapsedMs}ms`);
      
      if (result.rows && result.rows.length > 0) {
        console.log('📋 Sample data:');
        result.rows.slice(0, 3).forEach((row, idx) => {
          console.log(`   [${idx + 1}] ${JSON.stringify(row)}`);
        });
        if (result.rows.length > 3) {
          console.log(`   ... and ${result.rows.length - 3} more rows`);
        }
      }

    } catch (err) {
      console.log(`❌ Request failed: ${err.message}`);
    }
  }
  
  console.log('\n✨ Test completed!');
}

// Check if server is running first
function checkServer() {
  return new Promise((resolve) => {
    const req = http.get('http://localhost:3000/api/health', (res) => {
      resolve(true);
    });
    req.on('error', () => {
      resolve(false);
    });
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function main() {
  console.log('🚀 Checking if server is running on localhost:3000...');
  
  const serverRunning = await checkServer();
  if (!serverRunning) {
    console.log('❌ Server not running. Please start with: npm run dev');
    process.exit(1);
  }
  
  console.log('✅ Server is running\n');
  await testQueries();
}

main().catch(console.error);
