const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// Database configuration
const dbConfig = {
  user: process.env.POSTGRES_USER || 'cognihire',
  password: process.env.POSTGRES_PASSWORD || 'password',
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DATABASE || 'cognihire',
};

async function executeQuery(sql, binds = []) {
  const client = new Client(dbConfig);
  try {
    await client.connect();
    const result = await client.query(sql, binds);
    return result;
  } catch (err) {
    console.error('Error executing query:', sql, err);
    throw err;
  } finally {
    await client.end();
  }
}

async function runMigrations() {
  try {
    console.log('🚀 Starting database migrations...');

    // Read migration file
    const migrationPath = path.join(__dirname, '../migrations/001_initial_schema_postgres.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Split by semicolon and execute each statement
    const statements = migrationSQL.split(';').filter(stmt => stmt.trim());

    for (const statement of statements) {
      if (statement.trim()) {
        console.log('Executing:', statement.substring(0, 50) + '...');
        await executeQuery(statement);
      }
    }

    console.log('✅ All migrations completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigrations();