import { neon } from '@neondatabase/serverless';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('CRITICAL: DATABASE_URL environment variable is not set!');
} else {
  console.log('Database initialized with connection string length:', connectionString.length);
}

// Initialize Neon client
// We use 'pool' mode usually, but for serverless functions 'neon' direct client is often safer 
// unless we set up a dedicated pooler.
const sql = neon(connectionString!);

export { sql };

// Helper to generate UUIDs
export function generateId(): string {
  return crypto.randomUUID();
}

// Helper to get current timestamp
export function now(): string {
  return new Date().toISOString();
}
