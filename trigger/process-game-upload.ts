import { logger, task, wait } from "@trigger.dev/sdk"
import { updateTriggerGameUploadStatus } from "@/lib/axis-processing/triggerStatus"

type ProcessGameUploadPayload = {
  clerkUserId?: string | null
  sessionId: string
  traceId?: string
  userId?: string | null
}

export const processGameUpload = task({
  id: "process-game-upload",
  run: async (payload: ProcessGameUploadPayload) => {
    const traceId = payload.traceId || crypto.randomUUID()

    logger.log("Axis game upload queued", {
      sessionId: payload.sessionId,
      traceId,
    })

    await updateTriggerGameUploadStatus({
      detail: "Game queued.",
      jobStatus: "queued",
      clerkUserId: payload.clerkUserId,
      sessionId: payload.sessionId,
      sessionStatus: "queued",
      traceId,
      userId: payload.userId,
    })

    await wait.for({ seconds: 3 })

    logger.log("Axis game upload processing", {
      sessionId: payload.sessionId,
      traceId,
    })

    await updateTriggerGameUploadStatus({
      detail: "Processing game.",
      jobStatus: "processing",
      clerkUserId: payload.clerkUserId,
      sessionId: payload.sessionId,
      sessionStatus: "processing",
      traceId,
      userId: payload.userId,
    })

    await wait.for({ seconds: 3 })

    logger.log("Axis game upload complete", {
      sessionId: payload.sessionId,
      traceId,
    })

    await updateTriggerGameUploadStatus({
      detail: "Game processing complete.",
      jobStatus: "complete",
      clerkUserId: payload.clerkUserId,
      result: {
        completedAt: new Date().toISOString(),
        source: "trigger.dev",
        traceId,
      },
      sessionId: payload.sessionId,
      sessionStatus: "complete",
      traceId,
      userId: payload.userId,
    })

    return {
      sessionId: payload.sessionId,
      status: "complete",
      traceId,
    }
  },
})
