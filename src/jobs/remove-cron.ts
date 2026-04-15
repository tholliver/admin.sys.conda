/**
 * remove-cron.ts
 *
 * Removes the backup cron job from the OS scheduler.
 *
 *   bun run src/jobs/remove-cron.ts
 *
 * Windows : Deletes the Task Scheduler entry.
 * Linux   : Removes the line from the user's crontab.
 */

 const JOB_NAME = "pg-usb-backup";

 console.log(`Removing cron job: ${JOB_NAME}`);
 try {
   await Bun.cron.remove(JOB_NAME);
   console.log("✓ Removed successfully.");
 } catch (err) {
   console.error("✗ Failed to remove:", err);
 }
