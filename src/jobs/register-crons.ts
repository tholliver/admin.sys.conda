/**
 * register-crons.ts
 * Run this ONCE after each deploy to register/update OS-level cron jobs.
 * bun run src/jobs/register-crons.ts
 *
 * Idempotent — re-registering with the same title overwrites in place.
 */

const workerPath = new URL("./period-close.worker.ts", import.meta.url).pathname;

// 1st of each month at 00:05 — generate fees + rent + overdue scan
await Bun.cron(workerPath, "5 0 1 * *", "period-close");

console.log("✓ Cron jobs registered");
console.log("  period-close → 5 0 1 * * (1st of month 00:05 local time)");
