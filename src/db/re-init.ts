import { SQL as BunSQL } from "bun";

const dbSecret = Bun.env.DATABASE_URL;
if (!dbSecret) throw new Error("DATABASE_URL is not set");

const sql = new BunSQL(dbSecret);

const SCHEMAS_TO_RESET = ["public", "auth", "drizzle", "finance"];

// ==================== OPERATIONS ====================

async function dropAndRecreateSchema(schemaName: string) {
  console.log(`Resetting schema '${schemaName}'...`);
  try {
    await sql.unsafe(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
    await sql.unsafe(`CREATE SCHEMA ${schemaName}`);
    console.log(`✔ Schema '${schemaName}' reset`);
  } catch (err) {
    console.error(`✖ Failed to reset '${schemaName}':`, err);
  }
}

async function generateSchemaReport() {
  try {
    const schemas = await sql`
      SELECT
        s.schema_name,
        COUNT(t.table_name) AS table_count
      FROM information_schema.schemata s
      LEFT JOIN information_schema.tables t ON s.schema_name = t.table_schema
      WHERE s.schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast', 'pg_temp_1')
      GROUP BY s.schema_name
      ORDER BY s.schema_name
    `;

    console.log("\n📊 DATABASE SCHEMA REPORT\n" + "─".repeat(40));
    for (const s of schemas) {
      console.log(`  ${s.schema_name.padEnd(20)} ${s.table_count} tables`);
    }
    console.log("─".repeat(40) + "\n");
  } catch (err) {
    console.error("✖ Report failed:", err);
  }
}

// ==================== CLI ====================

const COMMANDS = {
  report:    "show schema and table summary",
  drop:      "drop and recreate a single schema  (e.g. drop public)",
  "drop-all":"drop and recreate all schemas",
} as const;

function printHelp() {
  console.log("\nUsage: bun run db:danger <command>\n");
  for (const [cmd, desc] of Object.entries(COMMANDS)) {
    console.log(`  ${cmd.padEnd(12)} ${desc}`);
  }
  console.log();
}

async function main() {
  const [cmd, arg] = process.argv.slice(2);

  switch (cmd) {
    case "report":
      await generateSchemaReport();
      break;

    case "drop":
      if (!arg) { console.error("✖ Usage: drop <schema>"); process.exit(1); }
      await dropAndRecreateSchema(arg);
      break;

    case "drop-all":
      for (const schema of SCHEMAS_TO_RESET) {
        await dropAndRecreateSchema(schema);
      }
      break;

    case "help":
    case "-h":
    case "--help":
      printHelp();
      break;

    default:
      console.error(`✖ Unknown command: ${cmd ?? "(none)"}`);
      printHelp();
      process.exit(1);
  }

  await sql.end?.();
}

await main();
