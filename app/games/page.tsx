import Link from "next/link"
import { retrieveSessionMemory } from "@/lib/mcp/supabaseMemory"
import { normalizeReplay } from "@/lib/normalizeReplay"
import { readProcessingSnapshot } from "@/lib/axis-processing/state"
import { createClient } from "@/lib/supabase/server"
import styles from "./page.module.css"

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {}
}

export default async function GamesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
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

  const result = await retrieveSessionMemory({
    supabase,
    userId: user.id,
    limit: 120,
  })

  const games = (result.data || []).map((session) => {
    const replay = normalizeReplay(session)
    const metadata = asRecord(session.metadata)
    const telemetry = asRecord(metadata.telemetry)
    const processing = readProcessingSnapshot(metadata.processing)

    return {
      id: replay.id,
      title: replay.title || replay.fileName || "Game film",
      createdAt: replay.createdAt,
      duration: replay.duration || 0,
      status: replay.status || "stored",
      processing,
      player: replay.player,
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
        <Link className={styles.captureLink} href="/game-day">
          Add Game
        </Link>
      </header>

      <section className={styles.history} aria-label="Saved game replays">
        {games.length === 0 ? (
          <div className={styles.empty}>No saved games yet.</div>
        ) : (
          games.map((game) => (
            <Link
              className={styles.gameRow}
              href={`/replay-native?session=${encodeURIComponent(game.id)}`}
              key={game.id}
            >
              <span className={styles.date}>{formatDate(game.createdAt)}</span>
              <span className={styles.name}>{game.title}</span>
              <span className={styles.meta}>
                {formatDuration(game.duration)} / {game.player}
              </span>
              <span className={styles.state}>
                {game.processing.state !== "IDLE"
                  ? game.processing.label
                  : game.hasTelemetry
                  ? `${game.telemetryFrames} frames`
                  : game.status}
              </span>
            </Link>
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
