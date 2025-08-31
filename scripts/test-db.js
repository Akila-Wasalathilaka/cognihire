const { Client } = require('pg');

// Database configuration
const dbConfig = {
  user: process.env.POSTGRES_USER || 'cognihire',
  password: process.env.POSTGRES_PASSWORD || 'password',
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DATABASE || 'cognihire',
};

async function testDatabaseConnection() {
  let client;
  try {
    console.log('Testing PostgreSQL database connection...');
    console.log('Config:', {
      user: dbConfig.user,
      host: dbConfig.host,
      port: dbConfig.port,
      database: dbConfig.database,
      password: dbConfig.password ? '***' : 'not set'
    });

    // Create connection
    client = new Client(dbConfig);
    await client.connect();
    console.log('✅ Connected successfully!');

    // Test query
    const result = await client.query('SELECT 1 as test');
    console.log('✅ Test query successful:', result.rows);

    // Check if tables exist
    const tables = ['tenants', 'users', 'games', 'job_roles'];
    for (const table of tables) {
      try {
        const countResult = await client.query(`SELECT COUNT(*) as count FROM ${table}`);
        console.log(`✅ Table ${table}: ${countResult.rows[0].count} records`);
      } catch (err) {
        console.log(`❌ Table ${table}: ${err.message}`);
      }
    }

  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
    process.exit(1);
  } finally {
    if (client) {
      try {
        await client.end();
        console.log('✅ Connection closed');
      } catch (err) {
        console.error('Error closing connection:', err);
      }
    }
  }
}

testDatabaseConnection();
