export async function triggerProcessGameUpload({
  clerkUserId,
  sessionId,
  traceId,
  userId,
}: {
  clerkUserId?: string | null
  sessionId: string
  traceId?: string
  userId?: string | null
}) {
  try {
    const { tasks } = await import("@trigger.dev/sdk")
    const run = await tasks.trigger(
      "process-game-upload",
      {
        clerkUserId,
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
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `Trigger job failed: ${error.message}`
        : "Trigger job failed."
    )
  }
}
