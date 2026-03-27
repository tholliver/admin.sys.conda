import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from 'pg'
import * as schema from "@/db/schema";

const isProd = import.meta.env.PROD;

const dbUrl = import.meta.env.DATABASE_URL;

// Validate that we have a database URL
if (!dbUrl) {
  throw new Error(`DATABASE_URL environment variable is required`);
}

const pool = new Pool({
  connectionString: dbUrl,
  max: 5,
  // idleTimeoutMillis: 30000,
  // connectionTimeoutMillis: 2000,
})

// Export the drizzle instance
export const db = drizzle(pool, { schema });

// Optional: Export for debugging (remove in production)
if (!isProd) {
  const dbName = dbUrl.split("/").pop();
  console.log(`Database connected to: ${dbName}`);
}
