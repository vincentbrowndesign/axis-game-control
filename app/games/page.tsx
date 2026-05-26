import { getAxisRequestIdentity } from "@/lib/axis-auth/identity"
import { retrieveSessionMemory } from "@/lib/mcp/supabaseMemory"
import { normalizeReplay } from "@/lib/normalizeReplay"
import { readProcessingSnapshot } from "@/lib/axis-processing/state"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import styles from "./page.module.css"

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {}
}

export default async function GamesPage() {
  const identity = await getAxisRequestIdentity()

  if (!identity) {
    return (
      <main className={styles.surface}>
        <header className={styles.telemetry}>
          <p className={styles.eyebrow}>AXIS ARCHIVE</p>
          <h1 className={styles.title}>Game history</h1>
        </header>
        <section className={styles.empty}>Sign in to see saved games.</section>
      </main>
    )
  }

  const result = identity.supabaseUserId
    ? await retrieveSessionMemory({
        supabase: await createClient(),
        userId: identity.supabaseUserId,
        limit: 120,
      })
    : await supabaseAdmin
        .from("axis_sessions")
        .select("*")
        .eq("clerk_user_id", identity.clerkUserId || "")
        .order("created_at", { ascending: false })
        .limit(120)

  const games = (result.data || []).map((session) => {
    const replay = normalizeReplay(session)
    const metadata = asRecord(session.metadata)
    const gameSession = asRecord(metadata.gameSession)
    const telemetry = asRecord(metadata.telemetry)
    const processing = readProcessingSnapshot(metadata.processing)
    const originalFilename =
      typeof gameSession.originalFilename === "string"
        ? gameSession.originalFilename
        : replay.fileName || "Game film"
    const fileSize =
      typeof gameSession.fileSize === "number"
        ? gameSession.fileSize
        : typeof metadata.originalSize === "number"
          ? metadata.originalSize
          : 0

    return {
      id: replay.id,
      title: originalFilename,
      createdAt: replay.createdAt,
      duration: replay.duration || 0,
      status:
        typeof gameSession.status === "string"
          ? gameSession.status
          : replay.status || "uploaded",
      processing,
      player: replay.player,
      fileSize,
      hasTelemetry: Boolean(telemetry.path),
      telemetryFrames:
        typeof telemetry.frameCount === "number"
          ? telemetry.frameCount
          : 0,
    }
  })

  return (
    <main className={styles.surface}>
      <header className={styles.telemetry}>
        <div>
          <p className={styles.eyebrow}>AXIS ARCHIVE</p>
          <h1 className={styles.title}>Game history</h1>
        </div>
        <p className={styles.captureLink}>Media dormant</p>
      </header>

      <section className={styles.history} aria-label="Saved game replays">
        {games.length === 0 ? (
          <div className={styles.empty}>No saved games yet.</div>
        ) : (
          games.map((game) => (
            <article
              className={styles.gameRow}
              key={game.id}
            >
              <span className={styles.date}>{formatDate(game.createdAt)}</span>
              <span className={styles.name}>{game.title}</span>
              <span className={styles.meta}>
                {formatDuration(game.duration)} / {formatBytes(game.fileSize)}
              </span>
              <span className={styles.state}>
                {game.processing.state !== "IDLE"
                  ? game.processing.label
                  : game.hasTelemetry
                  ? `${game.telemetryFrames} frames`
                  : game.status}
              </span>
            </article>
          ))
        )}
      </section>
    </main>
  )
}

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
  }).format(new Date(timestamp))
}

function formatDuration(seconds: number) {
  if (!seconds) return "00:00"
  const minutes = Math.floor(seconds / 60)
  const rest = Math.floor(seconds % 60)
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`
}

function formatBytes(bytes: number) {
  if (!bytes) return "0 MB"
  const megabytes = bytes / 1024 / 1024
  if (megabytes < 1024) return `${megabytes.toFixed(1)} MB`
  return `${(megabytes / 1024).toFixed(2)} GB`
}
