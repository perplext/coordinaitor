import { DatabaseService } from '../database/database-service';
import fs from 'fs';
import path from 'path';

async function runMarketplaceMigration() {
  console.log('Starting marketplace migration...');
  
  try {
    // Initialize database connection
    const db = DatabaseService.getInstance();
    await db.initialize();
    console.log('Database connection established');

    // Read the migration SQL file
    const migrationPath = path.join(__dirname, '../database/migrations/016_create_agent_marketplace_tables.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    console.log('Migration SQL loaded');

    // Execute the migration
    await db.executeQuery(migrationSQL);
    console.log('✅ Marketplace migration completed successfully');

    // Verify tables were created
    const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE '%marketplace%' OR table_name LIKE '%agent_%'
      ORDER BY table_name;
    `;
    
    const result = await db.executeQuery(tablesQuery);
    console.log('Created tables:');
    result.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });

    // Close database connection
    await db.close();
    console.log('Database connection closed');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  runMarketplaceMigration();
}

export { runMarketplaceMigration };