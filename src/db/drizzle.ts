import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Create connection
const connectionString = process.env.DATABASE_URL!;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required');
}

// Create postgres client
const client = postgres(connectionString, {
  prepare: false, // Disable prepared statements for better compatibility
});

// Create drizzle instance with schema
export const db = drizzle(client, { schema });

export type DbType = typeof db;
