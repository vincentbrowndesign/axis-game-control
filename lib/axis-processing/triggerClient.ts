import { tasks } from "@trigger.dev/sdk"

export async function triggerProcessGameUpload({
  sessionId,
  traceId,
  userId,
}: {
  sessionId: string
  traceId?: string
  userId: string
}) {
  const run = await tasks.trigger(
    "process-game-upload",
    {
      sessionId,
      traceId,
      userId,
    },
    {
      idempotencyKey: ["process-game-upload", sessionId],
      idempotencyKeyTTL: "24h",
      maxAttempts: 1,
    }
  )

  return {
    id: run.id,
  }
}
