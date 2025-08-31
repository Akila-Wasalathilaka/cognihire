const { Client } = require('pg');
const bcrypt = require('bcryptjs');

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

async function seedDatabase() {
  try {
    console.log('🌱 Seeding database with test data...');

    // Create test tenant
    const tenantId = '550e8400-e29b-41d4-a716-446655440000';
    await executeQuery(`
      INSERT INTO tenants (id, name, subdomain)
      VALUES ($1, $2, $3)
    `, [tenantId, 'Test Company', 'test']);

    // Create admin user
    const adminId = '550e8400-e29b-41d4-a716-446655440001';
    const adminPassword = await bcrypt.hash('admin123', 12);
    await executeQuery(`
      INSERT INTO users (id, tenant_id, email, username, password_hash, role, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [adminId, tenantId, 'admin@test.com', 'admin', adminPassword, 'ADMIN', true]);

    // Create test candidate
    const candidateId = '550e8400-e29b-41d4-a716-446655440002';
    const candidatePassword = await bcrypt.hash('candidate123', 12);
    await executeQuery(`
      INSERT INTO users (id, tenant_id, email, username, password_hash, role, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [candidateId, tenantId, 'candidate@test.com', 'candidate', candidatePassword, 'CANDIDATE', true]);

    // Create test job role
    const jobRoleId = '550e8400-e29b-41d4-a716-446655440003';
    await executeQuery(`
      INSERT INTO job_roles (id, tenant_id, title, description, traits_json)
      VALUES ($1, $2, $3, $4, $5)
    `, [jobRoleId, tenantId, 'Software Developer', 'Full-stack developer role',
         JSON.stringify({ memory: 0.4, logic: 0.3, attention: 0.3 })]);

    // Create test games
    const nbackId = '550e8400-e29b-41d4-a716-446655440004';
    await executeQuery(`
      INSERT INTO games (id, code, title, description, base_config)
      VALUES ($1, $2, $3, $4, $5)
    `, [nbackId, 'NBACK', 'N-Back Task', 'Working memory assessment',
         JSON.stringify({ timer: 300, rounds: 20, difficulty: 'medium' })]);

    const stroopId = '550e8400-e29b-41d4-a716-446655440005';
    await executeQuery(`
      INSERT INTO games (id, code, title, description, base_config)
      VALUES ($1, $2, $3, $4, $5)
    `, [stroopId, 'STROOP', 'Stroop Test', 'Cognitive interference assessment',
         JSON.stringify({ timer: 180, trials: 50, colors: ['red', 'blue', 'green'] })]);

    console.log('✅ Database seeded successfully!');
    console.log('📋 Test Credentials:');
    console.log('   Admin: admin@test.com / admin123');
    console.log('   Candidate: candidate@test.com / candidate123');

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

seedDatabase();