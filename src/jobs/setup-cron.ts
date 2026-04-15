/**
 * setup-cron.ts
 *
 * Registers the backup job with the OS scheduler via Bun.cron().
 * Run once from the project root — never needs to be run again unless
 * you want to change the schedule.
 *
 *   bun run src/jobs/setup-cron.ts
 *
 * Windows : Creates a Task Scheduler entry (no admin rights needed for
 *           per-user tasks).
 * Linux   : Writes a line to the user's crontab.
 *
 * ─── Schedule ────────────────────────────────────────────────────────────────
 *  18:30 Bolivia (BOT = UTC-4)  →  22:30 UTC  →  "30 22 * * *"  (every day)
 *  Edit CRON_EXPRESSION to change. Re-run this script after any change.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { platform } from "os";

const IS_WINDOWS = platform() === "win32";

// ── Config ────────────────────────────────────────────────────────────────────

// TEST  (every minute):       "* * * * *"
// PROD  (17:00 La Paz / BOT):  IS_WINDOWS ? "0 17 * * *" : "0 21 * * *"
//   Windows uses LOCAL time → 17:00 directly
//   Linux UTC server        → 21:00 UTC = 17:00 BOT (UTC-4)
const CRON_EXPRESSION = "*/1 * * * *";

// Name shown in Task Scheduler (Windows) / crontab comment (Linux)
const JOB_NAME = "pg-usb-backup";

// Bun.cron on Windows needs a plain Windows path, not a file:// URL.
const WORKER_PATH = IS_WINDOWS
    ? Bun.fileURLToPath(import.meta.resolve("./backup.job.ts"))
    : import.meta.resolve("./backup.job.ts");

// ── Register ──────────────────────────────────────────────────────────────────

console.log("=== pg-usb-backup — Bun.cron setup ===\n");
console.log(`Platform  : ${IS_WINDOWS ? "Windows" : "Linux"}`);
console.log(`Schedule  : ${CRON_EXPRESSION}`);
console.log(`Job name  : ${JOB_NAME}`);
console.log(`Worker    : ${WORKER_PATH}`);
console.log("");

// OS-level Bun.cron(path, schedule, title) returns Promise<void> — no job handle.
// Use Bun.cron.parse() separately to compute the next fire time.
// await Bun.cron(WORKER_PATH, CRON_EXPRESSION, JOB_NAME);
const { default: worker } = await import(WORKER_PATH);

Bun.cron(CRON_EXPRESSION, async () => {
  await worker.scheduled({
    cron: CRON_EXPRESSION,
    type: "scheduled",
    scheduledTime: Date.now(),
  } as Bun.CronController);
});

await new Promise(() => {}); // keep process alive

console.log(`✓ Registered with OS scheduler.`);

const next = Bun.cron.parse(CRON_EXPRESSION);
if (next) {
    console.log(`  Next run : ${next.toISOString()}`);
    console.log(`           : ${next.toLocaleString()} (your local time)`);
}

if (IS_WINDOWS) {
    console.log(`
Verify in Task Scheduler UI:
  taskschd.msc  →  Task Scheduler Library  →  "${JOB_NAME}"

Or from PowerShell:
  Get-ScheduledTask -TaskName "${JOB_NAME}"

Run a manual backup now (for testing):
  bun run src/jobs/backup.job.ts

Remove the scheduled task:
  bun run src/jobs/remove-cron.ts
`);
} else {
    console.log(`
Verify:
  crontab -l | grep ${JOB_NAME}

Run a manual backup now:
  bun src/jobs/backup.job.ts

Remove:
  bun run src/jobs/remove-cron.ts
`);
}
