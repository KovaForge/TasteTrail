import { Client } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
const localSettingsPath = path.join(__dirname, 'api', 'local.settings.json');
let connectionString = process.env.DATABASE_URL;

if (fs.existsSync(localSettingsPath)) {
    const settings = JSON.parse(fs.readFileSync(localSettingsPath, 'utf8'));
    connectionString = settings.Values.DATABASE_URL;
}

if (!connectionString) {
    console.error('DATABASE_URL not found');
    process.exit(1);
}

// Use Client instead of neon for raw SQL
const client = new Client(connectionString);

async function runMigration() {
    console.log('Checking migration 003...');
    
    // Read migration file
    const migrationPath = path.join(__dirname, 'db', 'migrations', '003_separate_user_state.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');

    try {
        await client.connect();
        console.log('Running migration 003...');
        await client.query(migrationSql);
        console.log('Migration 003 applied successfully.');
    } catch (error) {
         if (error.code === '42P07') { // duplicate_table
            console.log('Table user_menu_item_state already exists. Migration assumed applied.');
        } else if (error.message && error.message.includes('already exists')) {
             console.log('Object already exists. Migration assumed applied.');
        } else {
            console.error('Error applying migration:', error);
        }
    } finally {
        await client.end();
    }
}

runMigration();
