import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import {
  appendTimelineEvents,
  makeTimelineEvent,
} from "@/lib/axis/reinforcement"
import { createClient } from "@/lib/supabase/server"

function cleanTrigger(value: unknown) {
  return typeof value === "string"
    ? value.trim().toUpperCase().slice(0, 18)
    : ""
}

function cleanBehaviorPhrase(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 180) : ""
}

function cleanPlayerName(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 60) : ""
}

function playerIdFromName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60)
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        {
          error: "Authentication required",
        },
        {
          status: 401,
        }
      )
    }

    let body: {
      sessionId?: unknown
      triggerWord?: unknown
      behaviorPhrase?: unknown
      playerName?: unknown
      repeatTomorrow?: unknown
    } = {}

    try {
      body = await req.json()
    } catch {
      body = {}
    }

    const sessionId =
      typeof body.sessionId === "string" ? body.sessionId : ""
    const triggerWord = cleanTrigger(body.triggerWord)
    const behaviorPhrase = cleanBehaviorPhrase(body.behaviorPhrase)
    const playerName = cleanPlayerName(body.playerName)
    const repeatTomorrow = body.repeatTomorrow === true

    if (!sessionId) {
      return NextResponse.json(
        {
          error: "Session required",
        },
        {
          status: 400,
        }
      )
    }

    const existing = await supabase
      .from("axis_sessions")
      .select("metadata,tags")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .single<{
        metadata: Record<string, unknown> | null
        tags: string[] | null
      }>()

    if (existing.error) {
      return NextResponse.json(
        {
          error: existing.error.message,
        },
        {
          status: 404,
        }
      )
    }

    const metadata =
      existing.data.metadata && typeof existing.data.metadata === "object"
        ? existing.data.metadata
        : {}
    const tags = Array.isArray(existing.data.tags)
      ? existing.data.tags.filter((tag) => tag.toLowerCase() !== "repeat")
      : []

    if (repeatTomorrow) tags.push("repeat")
    const timelineEvents = [
      triggerWord
        ? makeTimelineEvent("TRIGGER_ASSIGNED", `Trigger: ${triggerWord}`)
        : null,
      behaviorPhrase
        ? makeTimelineEvent("CORRECTION_ADDED", `Behavior: ${behaviorPhrase}`)
        : null,
      repeatTomorrow
        ? makeTimelineEvent("REPEAT_MARKED", "Repeat tomorrow")
        : null,
    ].filter((event): event is NonNullable<typeof event> => Boolean(event))

    const updated = await supabase
      .from("axis_sessions")
      .update({
        tags,
        ...(playerName
          ? {
              player_name: playerName,
              player_id: playerIdFromName(playerName),
            }
          : {}),
        ...(behaviorPhrase ? { behavior_sentence: behaviorPhrase } : {}),
        metadata: {
          ...metadata,
          triggerWord,
          coachNote: behaviorPhrase || metadata.coachNote || "",
          behaviorPhrase: behaviorPhrase || metadata.behaviorPhrase || "",
          playerName: playerName || metadata.playerName || "",
          repeatTomorrow,
          correctionTimelineEvents: appendTimelineEvents(
            metadata,
            timelineEvents
          ),
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId)
      .eq("user_id", user.id)

    if (updated.error) {
      return NextResponse.json(
        {
          error: updated.error.message,
        },
        {
          status: 500,
        }
      )
    }

    revalidatePath("/")
    revalidatePath("/systems")
    revalidatePath("/sessions")
    revalidatePath("/team/local")

    return NextResponse.json({
      ok: true,
      triggerWord,
      behaviorPhrase,
      playerName,
      repeatTomorrow,
    })
  } catch (error) {
    console.error("QUICK TAG ERROR:", error)

    return NextResponse.json(
      {
        error: "Quick tag failed",
      },
      {
        status: 500,
      }
    )
  }
}
