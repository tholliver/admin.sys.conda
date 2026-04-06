/**
 * period-close.worker.ts
 * OS-level cron worker — spawned as a fresh process by the system scheduler.
 * Cannot use import.meta.env or @/ aliases — uses process.env and relative imports.
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import {
  employees, employeeFees,
  tenants, tenantPayments,
} from "@/db/schema";
import {
  and, eq, lt, isNull, inArray, count, sql,
} from "drizzle-orm";

function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

async function run() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL not set");

  // Fresh pool — this process lives only for this job run
  const pool = new Pool({ connectionString: dbUrl, max: 3 });
  const db = drizzle(pool);

  const period = currentPeriod();
  console.log(`[period-close] start — ${period}`);

  // ── 1. Bulk generate employee fees ──────────────────────────────────
  try {
    const activeEmps = await db
      .select({ id: employees.id, baseSalary: employees.baseSalary })
      .from(employees)
      .where(
        and(
          isNull(employees.deletedAt),
          inArray(employees.status, ["activo", "suspendido", "licencia"])
        )
      );

    if (activeEmps.length > 0) {
      const empIds = activeEmps.map(e => e.id);

      const existing = await db
        .select({ employeeId: employeeFees.employeeId })
        .from(employeeFees)
        .where(and(eq(employeeFees.period, period), inArray(employeeFees.employeeId, empIds)));

      const existingSet = new Set(existing.map(r => r.employeeId));
      const toInsert = activeEmps.filter(e => !existingSet.has(e.id));

      if (toInsert.length > 0) {
        await db.insert(employeeFees).values(
          toInsert.map(e => ({
            employeeId: e.id,
            period,
            amount: e.baseSalary,
            status: "pendiente" as const,
          }))
        ).onConflictDoNothing();
        console.log(`[period-close] employee fees created: ${toInsert.length}`);
      } else {
        console.log(`[period-close] employee fees: all already generated`);
      }
    }
  } catch (err) {
    console.error("[period-close] employee fees failed:", err);
  }

  // ── 2. Bulk generate tenant payments ────────────────────────────────
  try {
    const activeTens = await db
      .select({ id: tenants.id, monthlyRent: tenants.monthlyRent })
      .from(tenants)
      .where(
        and(
          isNull(tenants.deletedAt),
          inArray(tenants.status, ["activo", "moroso"])
        )
      );

    if (activeTens.length > 0) {
      const tenIds = activeTens.map(t => t.id);

      const existing = await db
        .select({ tenantId: tenantPayments.tenantId })
        .from(tenantPayments)
        .where(and(eq(tenantPayments.period, period), inArray(tenantPayments.tenantId, tenIds)));

      const existingSet = new Set(existing.map(r => r.tenantId));
      const toInsert = activeTens.filter(t => !existingSet.has(t.id));

      if (toInsert.length > 0) {
        await db.insert(tenantPayments).values(
          toInsert.map(t => ({
            tenantId: t.id,
            period,
            amount: t.monthlyRent,
            status: "pendiente" as const,
          }))
        ).onConflictDoNothing();
        console.log(`[period-close] tenant payments created: ${toInsert.length}`);
      } else {
        console.log(`[period-close] tenant payments: all already generated`);
      }
    }
  } catch (err) {
    console.error("[period-close] tenant payments failed:", err);
  }

  // ── 3. Mark overdue tenants as moroso ───────────────────────────────
  try {
    const now = new Date();
    now.setDate(now.getDate() - 30);
    const cutoff = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const overdue = await db
      .selectDistinct({ tenantId: tenantPayments.tenantId })
      .from(tenantPayments)
      .where(and(eq(tenantPayments.status, "pendiente"), lt(tenantPayments.period, cutoff)));

    const ids = overdue.map(r => r.tenantId).filter((id): id is number => id !== null);

    if (ids.length > 0) {
      await db
        .update(tenants)
        .set({ status: "moroso", updatedAt: new Date() })
        .where(and(inArray(tenants.id, ids), eq(tenants.status, "activo"), isNull(tenants.deletedAt)));

      console.log(`[period-close] marked moroso: ${ids.length}`);
    }
  } catch (err) {
    console.error("[period-close] overdue scan failed:", err);
  }

  await pool.end();
  console.log(`[period-close] done`);
}

// Required by Bun OS-level cron — Cloudflare Workers Cron Triggers API shape
export default {
  async scheduled(controller: Bun.CronController) {
    console.log(`[period-close] triggered — schedule: ${controller.cron}`);
    await run();
  },
};
