import { Pool, PoolClient } from 'pg';
import { v4 as uuidv4 } from 'uuid';

// Database configuration
const dbConfig = {
  user: process.env.POSTGRES_USER || 'cognihire',
  password: process.env.POSTGRES_PASSWORD || 'password',
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DATABASE || 'cognihire',
  max: parseInt(process.env.POSTGRES_POOL_MAX || '10'),
  min: parseInt(process.env.POSTGRES_POOL_MIN || '2'),
  idleTimeoutMillis: parseInt(process.env.POSTGRES_IDLE_TIMEOUT || '30000'),
  connectionTimeoutMillis: parseInt(process.env.POSTGRES_CONNECTION_TIMEOUT || '2000'),
};

// Connection pool
let pool: Pool | null = null;

// Check if PostgreSQL is available
const isPostgresAvailable = () => {
  try {
    require('pg');
    return true;
  } catch {
    return false;
  }
};

// Initialize the connection pool
export async function initializePool(): Promise<void> {
  if (!isPostgresAvailable()) {
    console.warn('PostgreSQL database module not available. Running in development mode without database.');
    return;
  }

  try {
    pool = new Pool(dbConfig);

    // Test the connection
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();

    console.log('PostgreSQL connection pool created successfully');
  } catch (err) {
    console.error('Error creating PostgreSQL connection pool:', err);
    throw err;
  }
}

// Get a client from the pool
export async function getClient(): Promise<PoolClient> {
  if (!pool) {
    throw new Error('Database pool not initialized');
  }
  return await pool.connect();
}

// Execute a query with automatic client management
export async function executeQuery(query: string, params: any[] = []): Promise<any> {
  if (!pool) {
    throw new Error('Database pool not initialized');
  }

  const client = await pool.connect();
  try {
    const result = await client.query(query, params);
    return result;
  } finally {
    client.release();
  }
}

// Execute multiple queries in a transaction
export async function executeTransaction(queries: Array<{ query: string; params: any[] }>): Promise<any[]> {
  if (!pool) {
    throw new Error('Database pool not initialized');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const results = [];

    for (const { query, params } of queries) {
      const result = await client.query(query, params);
      results.push(result);
    }

    await client.query('COMMIT');
    return results;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Close the connection pool
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('PostgreSQL connection pool closed');
  }
}

// Health check
export async function healthCheck(): Promise<boolean> {
  try {
    if (!pool) return false;
    const result = await executeQuery('SELECT 1 as health_check');
    return result.rows[0].health_check === 1;
  } catch {
    return false;
  }
}

// Generate a new UUID
export function generateId(): string {
  return uuidv4();
}

