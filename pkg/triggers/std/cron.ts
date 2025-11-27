/**
 * Cron trigger for Conv3n.
 * Schedules workflow execution based on a cron expression.
 */

import { createTrigger } from "../../sdk/src/trigger";
import { Cron, type CronJob } from "croner";

interface CronTriggerConfig {
  schedule: string; // Cron expression, e.g., "* * * * *"
}

// Use a variable in the module scope to hold the CronJob instance.
// This works because `createTrigger` defines a singleton-like behavior for each trigger definition file.
// The Go orchestrator will spawn a new Bun process for each unique trigger *instance*,
// ensuring this variable is unique per running trigger.
let cronJobInstance: CronJob | undefined;
let currentSchedule: string | undefined;

export default createTrigger<CronTriggerConfig>({
  id: "std/cron",

  // onStart is called when the trigger is initialized.
  // It sets up the cron job based on the provided schedule.
  async onStart(ctx) {
    const { schedule } = ctx.config;

    if (!schedule) {
      console.error(
        `Cron trigger '${this.id}' missing required 'schedule' configuration.`
      );
      return;
    }

    // If there's an existing job, stop it before creating a new one (e.g., if config changes)
    if (cronJobInstance) {
      cronJobInstance.stop();
      console.log(`Stopped previous cron job for '${currentSchedule}'.`);
    }

    try {
      // Create a new cron job.
      // The callback function will be executed according to the schedule.
      cronJobInstance = new Cron(schedule, async () => {
        console.log(
          `Cron trigger '${this.id}' fired for schedule '${schedule}'.`
        );
        // Fire the associated workflow.
        await ctx.fire({ schedule, timestamp: Date.now() });
      });
      currentSchedule = schedule; // Store the current schedule for logging/identification
      console.log(`Cron trigger '${this.id}' started with schedule '${schedule}'.`);
    } catch (error) {
      console.error(
        `Failed to start cron trigger '${this.id}' with schedule '${schedule}':`,
        error
      );
    }
  },

  // onStop is called when the trigger is shut down.
  // It stops the running cron job to prevent further executions.
  async onStop(ctx) {
    if (cronJobInstance) {
      cronJobInstance.stop(); // Stop the croner job.
      console.log(`Cron trigger '${this.id}' stopped for schedule '${currentSchedule}'.`);
      cronJobInstance = undefined;
      currentSchedule = undefined;
    } else {
      console.warn(`Cron trigger '${this.id}' had no active job to stop.`);
    }
  },
});