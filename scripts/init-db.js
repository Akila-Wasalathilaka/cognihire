const fs = require('fs');
const path = require('path');
const oracledb = require('oracledb');

// Database configuration
const dbConfig = {
  user: process.env.ORACLE_USER || 'cognihire',
  password: process.env.ORACLE_PASSWORD || 'password',
  connectString: process.env.ORACLE_CONNECT_STRING || 'localhost:1521/XE',
  poolMin: 2,
  poolMax: 10,
  poolIncrement: 1,
  poolPingInterval: 60,
};

async function initializeDatabase() {
  let connection;
  try {
    console.log('Connecting to Oracle database...');

    // Create connection
    connection = await oracledb.getConnection(dbConfig);
    console.log('Connected successfully!');

    // Read and execute the schema migration
    const schemaPath = path.join(__dirname, '..', 'migrations', '001_initial_schema.sql');
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');

    console.log('Executing schema migration...');

    // Split SQL commands and execute them
    const commands = schemaSQL.split(';').filter(cmd => cmd.trim().length > 0);

    for (const command of commands) {
      if (command.trim()) {
        try {
          await connection.execute(command);
          console.log('Executed:', command.substring(0, 50) + '...');
        } catch (err) {
          // Ignore errors for some statements (like CREATE SEQUENCE if it already exists)
          if (!err.message.includes('already exists') && !err.message.includes('ORA-00955')) {
            console.warn('Warning executing command:', err.message);
          }
        }
      }
    }

    // Commit the transaction
    await connection.commit();
    console.log('Schema migration completed successfully!');

    // Seed initial data
    console.log('Seeding initial data...');
    await seedInitialData(connection);

    console.log('Database initialization completed successfully!');

  } catch (err) {
    console.error('Database initialization failed:', err);
    throw err;
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error('Error closing connection:', err);
      }
    }
  }
}

async function seedInitialData(connection) {
  // Seed default tenant
  const tenantId = '550e8400-e29b-41d4-a716-446655440000';
  try {
    await connection.execute(
      `INSERT INTO TENANTS (id, name, subdomain) VALUES (:id, :name, :subdomain)`,
      [tenantId, 'Default Tenant', 'default']
    );
    console.log('Default tenant created');
  } catch (err) {
    if (!err.message.includes('ORA-00001')) { // Ignore duplicate key errors
      console.warn('Warning creating tenant:', err.message);
    }
  }

  // Seed games
  const games = [
    {
      id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
      code: 'NBACK',
      title: 'N-Back Memory Task',
      description: 'A working memory task where participants respond when the current stimulus matches the one presented N positions back.',
      baseConfig: JSON.stringify({
        n: 2,
        trials: 20,
        stimulusDuration: 500,
        isi: 2500,
        targets: 0.3,
        timer: 300
      })
    },
    {
      id: '6ba7b811-9dad-11d1-80b4-00c04fd430c8',
      code: 'STROOP',
      title: 'Stroop Color-Word Test',
      description: 'A test of cognitive interference where participants name the color of ink while ignoring conflicting color words.',
      baseConfig: JSON.stringify({
        trials: 24,
        colors: ['red', 'blue', 'green', 'yellow'],
        congruentRatio: 0.5,
        stimulusDuration: 2000,
        timer: 240
      })
    },
    {
      id: '6ba7b812-9dad-11d1-80b4-00c04fd430c8',
      code: 'REACTION_TIME',
      title: 'Simple Reaction Time',
      description: 'Measures basic reaction time to visual stimuli.',
      baseConfig: JSON.stringify({
        trials: 30,
        stimuli: ['circle', 'square', 'triangle'],
        minDelay: 1000,
        maxDelay: 3000,
        timer: 180
      })
    }
  ];

  for (const game of games) {
    try {
      await connection.execute(
        `INSERT INTO GAMES (id, code, title, description, base_config)
         VALUES (:id, :code, :title, :description, :baseConfig)`,
        [game.id, game.code, game.title, game.description, game.baseConfig]
      );
      console.log(`Game ${game.code} created`);
    } catch (err) {
      if (!err.message.includes('ORA-00001')) {
        console.warn(`Warning creating game ${game.code}:`, err.message);
      }
    }
  }

  // Seed game-trait mappings
  const traitMappings = [
    { gameId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8', trait: 'memory', weight: 0.8 },
    { gameId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8', trait: 'attention', weight: 0.6 },
    { gameId: '6ba7b811-9dad-11d1-80b4-00c04fd430c8', trait: 'cognitive_flexibility', weight: 0.7 },
    { gameId: '6ba7b811-9dad-11d1-80b4-00c04fd430c8', trait: 'processing_speed', weight: 0.5 },
    { gameId: '6ba7b812-9dad-11d1-80b4-00c04fd430c8', trait: 'processing_speed', weight: 0.9 },
    { gameId: '6ba7b812-9dad-11d1-80b4-00c04fd430c8', trait: 'attention', weight: 0.4 }
  ];

  for (const mapping of traitMappings) {
    try {
      await connection.execute(
        `INSERT INTO GAME_TRAIT_MAP (id, game_id, trait, weight)
         VALUES (SYS_GUID(), :gameId, :trait, :weight)`,
        [mapping.gameId, mapping.trait, mapping.weight]
      );
    } catch (err) {
      console.warn('Warning creating trait mapping:', err.message);
    }
  }

  // Seed job roles
  const jobRoles = [
    {
      id: '7ba7b810-9dad-11d1-80b4-00c04fd430c8',
      title: 'Software Developer',
      description: 'Full-stack software development position requiring strong problem-solving and cognitive skills.',
      traits: JSON.stringify({
        memory: 0.4,
        attention: 0.3,
        cognitive_flexibility: 0.5,
        processing_speed: 0.6,
        logical_reasoning: 0.7
      }),
      config: JSON.stringify({
        assessmentDuration: 3600,
        gamesCount: 3
      })
    },
    {
      id: '7ba7b811-9dad-11d1-80b4-00c04fd430c8',
      title: 'Data Analyst',
      description: 'Data analysis role requiring attention to detail and analytical thinking.',
      traits: JSON.stringify({
        memory: 0.5,
        attention: 0.8,
        cognitive_flexibility: 0.4,
        processing_speed: 0.5,
        logical_reasoning: 0.6
      }),
      config: JSON.stringify({
        assessmentDuration: 2700,
        gamesCount: 2
      })
    },
    {
      id: '7ba7b812-9dad-11d1-80b4-00c04fd430c8',
      title: 'Project Manager',
      description: 'Project management position requiring multitasking and strategic thinking.',
      traits: JSON.stringify({
        memory: 0.6,
        attention: 0.7,
        cognitive_flexibility: 0.8,
        processing_speed: 0.4,
        logical_reasoning: 0.5
      }),
      config: JSON.stringify({
        assessmentDuration: 2400,
        gamesCount: 3
      })
    }
  ];

  for (const role of jobRoles) {
    try {
      await connection.execute(
        `INSERT INTO JOB_ROLES (id, tenant_id, title, description, traits_json, config_json)
         VALUES (:id, :tenantId, :title, :description, :traits, :config)`,
        [role.id, tenantId, role.title, role.description, role.traits, role.config]
      );
      console.log(`Job role ${role.title} created`);
    } catch (err) {
      if (!err.message.includes('ORA-00001')) {
        console.warn(`Warning creating job role ${role.title}:`, err.message);
      }
    }
  }

  // Seed role-game packages
  const roleGamePackages = [
    // Software Developer
    { roleId: '7ba7b810-9dad-11d1-80b4-00c04fd430c8', gameId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8', orderIndex: 1, timerSeconds: 300 },
    { roleId: '7ba7b810-9dad-11d1-80b4-00c04fd430c8', gameId: '6ba7b811-9dad-11d1-80b4-00c04fd430c8', orderIndex: 2, timerSeconds: 240 },
    { roleId: '7ba7b810-9dad-11d1-80b4-00c04fd430c8', gameId: '6ba7b812-9dad-11d1-80b4-00c04fd430c8', orderIndex: 3, timerSeconds: 180 },

    // Data Analyst
    { roleId: '7ba7b811-9dad-11d1-80b4-00c04fd430c8', gameId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8', orderIndex: 1, timerSeconds: 300 },
    { roleId: '7ba7b811-9dad-11d1-80b4-00c04fd430c8', gameId: '6ba7b812-9dad-11d1-80b4-00c04fd430c8', orderIndex: 2, timerSeconds: 180 },

    // Project Manager
    { roleId: '7ba7b812-9dad-11d1-80b4-00c04fd430c8', gameId: '6ba7b811-9dad-11d1-80b4-00c04fd430c8', orderIndex: 1, timerSeconds: 240 },
    { roleId: '7ba7b812-9dad-11d1-80b4-00c04fd430c8', gameId: '6ba7b812-9dad-11d1-80b4-00c04fd430c8', orderIndex: 2, timerSeconds: 180 },
    { roleId: '7ba7b812-9dad-11d1-80b4-00c04fd430c8', gameId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8', orderIndex: 3, timerSeconds: 300 }
  ];

  for (const pkg of roleGamePackages) {
    try {
      await connection.execute(
        `INSERT INTO ROLE_GAME_PACKAGE (id, job_role_id, game_id, order_index, timer_seconds)
         VALUES (SYS_GUID(), :roleId, :gameId, :orderIndex, :timerSeconds)`,
        [pkg.roleId, pkg.gameId, pkg.orderIndex, pkg.timerSeconds]
      );
    } catch (err) {
      console.warn('Warning creating role-game package:', err.message);
    }
  }

  // Seed default admin user
  const adminPasswordHash = '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj6fEtTT2/Dm'; // 'admin123'
  try {
    await connection.execute(
      `INSERT INTO USERS (id, tenant_id, username, password_hash, role, is_active)
       VALUES (:id, :tenantId, :username, :passwordHash, :role, 1)`,
      ['8ba7b810-9dad-11d1-80b4-00c04fd430c8', tenantId, 'admin', adminPasswordHash, 'ADMIN']
    );
    console.log('Default admin user created (username: admin, password: admin123)');
  } catch (err) {
    if (!err.message.includes('ORA-00001')) {
      console.warn('Warning creating admin user:', err.message);
    }
  }

  // Seed sample candidate user
  const candidatePasswordHash = '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj6fEtTT2/Dm'; // 'candidate123'
  try {
    await connection.execute(
      `INSERT INTO USERS (id, tenant_id, username, password_hash, role, is_active)
       VALUES (:id, :tenantId, :username, :passwordHash, :role, 1)`,
      ['8ba7b811-9dad-11d1-80b4-00c04fd430c8', tenantId, 'candidate', candidatePasswordHash, 'CANDIDATE']
    );
    console.log('Sample candidate user created (username: candidate, password: candidate123)');
  } catch (err) {
    if (!err.message.includes('ORA-00001')) {
      console.warn('Warning creating candidate user:', err.message);
    }
  }
}

// Run the initialization
if (require.main === module) {
  initializeDatabase()
    .then(() => {
      console.log('Database initialization completed successfully!');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Database initialization failed:', err);
      process.exit(1);
    });
}

module.exports = { initializeDatabase };
