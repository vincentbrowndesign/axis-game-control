import { axisTodayRange } from "@/lib/axis-daily/continuity"
import { supabaseAdmin } from "@/lib/supabase/admin"

export type AxisSession = {
  created_at: string
  duration_seconds: number
  ended_at: string | null
  id: string
  organization_slug: string
  started_at: string
  status: "active" | "complete"
  user_id: string
}

const SESSION_SELECT =
  "id, user_id, organization_slug, started_at, ended_at, duration_seconds, status, created_at"

export async function getTodaySession({
  organizationSlug,
  userId,
}: {
  organizationSlug: string
  userId: string
}) {
  const { end, start } = axisTodayRange()

  const result = await supabaseAdmin
    .from("sessions")
    .select(SESSION_SELECT)
    .eq("user_id", userId)
    .eq("organization_slug", organizationSlug)
    .gte("started_at", start.toISOString())
    .lt("started_at", end.toISOString())
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle<AxisSession>()

  if (result.error) {
    console.error("AXIS SESSION READ FAILED", {
      code: result.error.code,
      detail: result.error.details,
      hint: result.error.hint,
      message: result.error.message,
      organizationSlug,
      userId,
    })

    return null
  }

  return result.data
}

export async function startSession({
  organizationSlug,
  userId,
}: {
  organizationSlug: string
  userId: string
}) {
  const existing = await getTodaySession({ organizationSlug, userId })

  if (existing?.status === "active") {
    return {
      duplicate: true,
      session: existing,
    }
  }

  if (existing?.status === "complete") {
    return {
      duplicate: true,
      session: existing,
    }
  }

  const result = await supabaseAdmin
    .from("sessions")
    .insert({
      organization_slug: organizationSlug,
      started_at: new Date().toISOString(),
      status: "active",
      user_id: userId,
    })
    .select(SESSION_SELECT)
    .single<AxisSession>()

  if (result.error) {
    console.error("AXIS SESSION START FAILED", {
      code: result.error.code,
      detail: result.error.details,
      hint: result.error.hint,
      message: result.error.message,
      organizationSlug,
      userId,
    })

    return {
      error: result.error,
    }
  }

  return {
    duplicate: false,
    session: result.data,
  }
}

export async function endSession({
  organizationSlug,
  sessionId,
  userId,
}: {
  organizationSlug: string
  sessionId?: string
  userId: string
}) {
  const existing =
    (sessionId
      ? await getSessionById({ organizationSlug, sessionId, userId })
      : null) || (await getTodaySession({ organizationSlug, userId }))

  if (!existing) {
    return {
      error: new Error("Session not found"),
    }
  }

  if (existing.status === "complete" || existing.ended_at) {
    return {
      duplicate: true,
      session: existing,
    }
  }

  const endedAt = new Date().toISOString()
  const durationSeconds = completedSessionSeconds({
    endedAt,
    startedAt: existing.started_at,
  })

  const result = await supabaseAdmin
    .from("sessions")
    .update({
      duration_seconds: durationSeconds,
      ended_at: endedAt,
      status: "complete",
    })
    .eq("id", existing.id)
    .eq("user_id", userId)
    .eq("organization_slug", organizationSlug)
    .select(SESSION_SELECT)
    .single<AxisSession>()

  if (result.error) {
    console.error("AXIS SESSION END FAILED", {
      code: result.error.code,
      detail: result.error.details,
      hint: result.error.hint,
      message: result.error.message,
      organizationSlug,
      sessionId: existing.id,
      userId,
    })

    return {
      error: result.error,
    }
  }

  return {
    duplicate: false,
    session: result.data,
  }
}

async function getSessionById({
  organizationSlug,
  sessionId,
  userId,
}: {
  organizationSlug: string
  sessionId: string
  userId: string
}) {
  const result = await supabaseAdmin
    .from("sessions")
    .select(SESSION_SELECT)
    .eq("id", sessionId)
    .eq("user_id", userId)
    .eq("organization_slug", organizationSlug)
    .maybeSingle<AxisSession>()

  if (result.error) {
    console.error("AXIS SESSION BY ID FAILED", {
      code: result.error.code,
      detail: result.error.details,
      hint: result.error.hint,
      message: result.error.message,
      organizationSlug,
      sessionId,
      userId,
    })

    return null
  }

  return result.data
}

function completedSessionSeconds({
  endedAt,
  startedAt,
}: {
  endedAt: string
  startedAt: string
}) {
  const started = new Date(startedAt).getTime()
  const ended = new Date(endedAt).getTime()
  const diffSeconds = Math.round((ended - started) / 1000)

  if (!Number.isFinite(diffSeconds)) return 0

  return Math.max(0, diffSeconds)
}
