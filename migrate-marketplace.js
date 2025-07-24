const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMarketplaceMigration() {
  console.log('Starting marketplace migration...');
  
  try {
    // Create database client
    const client = new Client({
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '5432'),
      database: process.env.DATABASE_NAME || 'orchestrator',
      user: process.env.DATABASE_USER || 'postgres',
      password: process.env.DATABASE_PASSWORD || 'password'
    });

    // Connect to database
    await client.connect();
    console.log('Database connection established');

    // Read the migration SQL file
    const migrationPath = path.join(__dirname, 'src/database/migrations/016_create_agent_marketplace_tables.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    console.log('Migration SQL loaded');

    // Execute the migration
    await client.query(migrationSQL);
    console.log('✅ Marketplace migration completed successfully');

    // Verify tables were created
    const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND (table_name LIKE '%marketplace%' OR table_name LIKE '%agent_%')
      ORDER BY table_name;
    `;
    
    const result = await client.query(tablesQuery);
    console.log('Created tables:');
    result.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });

    // Close database connection
    await client.end();
    console.log('Database connection closed');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
runMarketplaceMigration();