import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import {
  clusterCoachingLanguage,
  normalizeCoachingPhrase,
} from "@/lib/axis-ai/clusterCoachingLanguage"
import { mapWorkflowStage } from "@/lib/axis-ai/mapWorkflowStage"
import { suggestBehaviorTags } from "@/lib/axis-ai/suggestBehaviorTags"
import { createClient } from "@/lib/supabase/server"

function cleanPhrase(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 220) : ""
}

function cleanText(value: unknown, maxLength = 320) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : ""
}

function cleanNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null
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
      phrase?: unknown
      workflowStage?: unknown
      occurredAtSeconds?: unknown
      audioPath?: unknown
      audioMimeType?: unknown
      audioSizeBytes?: unknown
      audioDurationSeconds?: unknown
    } = {}

    try {
      body = await req.json()
    } catch {
      body = {}
    }

    const phrase = cleanPhrase(body.phrase)
    const sessionId =
      typeof body.sessionId === "string" && body.sessionId.length
        ? body.sessionId
        : null
    const workflowStage = mapWorkflowStage(body.workflowStage)
    const occurredAtSeconds =
      typeof body.occurredAtSeconds === "number" &&
      Number.isFinite(body.occurredAtSeconds)
        ? body.occurredAtSeconds
        : null
    const audioPath = cleanText(body.audioPath)
    const audioMimeType = cleanText(body.audioMimeType, 120)
    const audioSizeBytes = cleanNumber(body.audioSizeBytes)
    const audioDurationSeconds = cleanNumber(body.audioDurationSeconds)

    if (!phrase) {
      return NextResponse.json(
        {
          error: "Phrase required",
        },
        {
          status: 400,
        }
      )
    }

    const aiTags = suggestBehaviorTags(phrase)
    const inserted = await supabase
      .from("axis_voice_notes")
      .insert({
        user_id: user.id,
        session_id: sessionId,
        phrase,
        normalized_phrase: normalizeCoachingPhrase(phrase),
        workflow_stage: workflowStage,
        occurred_at_seconds: occurredAtSeconds,
        metadata: {
          aiTags,
          audioPath: audioPath || null,
          audioMimeType: audioMimeType || null,
          audioSizeBytes,
          audioDurationSeconds,
          hasReplayAudio: Boolean(audioPath),
        },
      })
      .select("id")
      .single<{ id: string }>()

    if (inserted.error) {
      return NextResponse.json(
        {
          error: inserted.error.message,
        },
        {
          status: 500,
        }
      )
    }

    const clusters = clusterCoachingLanguage([
      {
        id: inserted.data.id,
        phrase,
        workflowStage,
      },
    ])

    if (sessionId) {
      await supabase.from("axis_clip_phrase_links").insert({
        user_id: user.id,
        session_id: sessionId,
        phrase_id: inserted.data.id,
        confidence: 0.92,
        metadata: {
          reason: "same clip",
          phrase,
        },
      })

      const existing = await supabase
        .from("axis_sessions")
        .select("session_transcript,clip_phrase_links,metadata")
        .eq("id", sessionId)
        .eq("user_id", user.id)
        .maybeSingle<{
          session_transcript: string | null
          clip_phrase_links: Record<string, unknown>[] | null
          metadata: Record<string, unknown> | null
        }>()

      const transcript = [
        existing.data?.session_transcript || "",
        phrase,
      ]
        .filter(Boolean)
        .join("\n")
      const links = Array.isArray(existing.data?.clip_phrase_links)
        ? existing.data.clip_phrase_links
        : []
      const metadata =
        existing.data?.metadata && typeof existing.data.metadata === "object"
          ? existing.data.metadata
          : {}

      await supabase
        .from("axis_sessions")
        .update({
          session_transcript: transcript,
          ai_suggested_tags: aiTags,
          semantic_tags: aiTags,
          behavior_clusters: clusters,
          ai_phrase_summary: clusters[0]
            ? `Most repeated: ${clusters[0].label}`
            : phrase,
          clip_phrase_links: [
            ...links,
            {
              phraseId: inserted.data.id,
              phrase,
              confidence: 0.92,
            },
          ].slice(-20),
          metadata: {
            ...metadata,
            sessionTranscript: transcript,
            aiSuggestedTags: aiTags,
            behaviorClusters: clusters,
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", sessionId)
        .eq("user_id", user.id)
    }

    revalidatePath("/")
    revalidatePath("/sessions")
    revalidatePath("/team/local")

    return NextResponse.json({
      ok: true,
      phraseId: inserted.data.id,
      phrase,
      clusters,
    })
  } catch (error) {
    console.error("VOICE NOTE ERROR:", error)

    return NextResponse.json(
      {
        error: "Voice note failed",
      },
      {
        status: 500,
      }
    )
  }
}
