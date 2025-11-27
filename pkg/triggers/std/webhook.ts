/**
 * Webhook trigger for Conv3n.
 * Receives an invocation from the Go orchestrator and fires the associated workflow.
 */

import { createTrigger } from "../../sdk/src/trigger";
import type { OrchestratorMessage } from "../../sdk/src/types";

export default createTrigger({
  id: "std/webhook",

  // The onStart method is called when the trigger is initialized by the Go orchestrator.
  // For webhooks, we primarily just need to confirm that it's ready to receive invocations.
  async onStart(ctx) {
    console.log(`Webhook trigger '${this.id}' started. Awaiting invocations...`);
  },

  // The onStop method is called when the trigger is being shut down.
  // Webhooks don't hold persistent connections or resources that need explicit cleanup in the TS layer.
  async onStop(ctx) {
    console.log(`Webhook trigger '${this.id}' stopped.`);
  },

  // The onMessage method handles custom messages sent from the Go orchestrator.
  // For a webhook, the orchestrator will send an "invoke" message with the HTTP request payload
  // when a corresponding HTTP endpoint is hit.
  async onMessage(message: OrchestratorMessage, ctx) {
    if (message.type === "invoke") {
      console.log(`Webhook trigger '${this.id}' received invocation.`);
      // Fire the workflow with the payload received from the orchestrator.
      // The payload typically contains details of the incoming HTTP request.
      await ctx.fire(message.payload);
    } else {
      console.warn(
        `Webhook trigger '${this.id}' received unknown message type: ${message.type}`
      );
    }
  },
});
