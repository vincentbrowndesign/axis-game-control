// One-tap session start: create with sane defaults and go live immediately.
// The coach names it later from the session workspace.

export type InstantSessionResult =
  | { ok: true; id: string }
  | { ok: false; tone: "error" | "offline"; message: string };

export async function startInstantSession(): Promise<InstantSessionResult> {
  const dateLabel = new Date().toLocaleDateString("en-US", { day: "numeric", month: "short" });
  const create = await fetch("/api/axis/events", {
    body: JSON.stringify({
      event_type: "training",
      source_mode: "record_now",
      title: `Session · ${dateLabel}`,
    }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  }).catch(() => null);
  if (!create || create.status === 503) {
    return { message: "Session memory is offline right now.", ok: false, tone: "offline" };
  }
  if (!create.ok) {
    return { message: "Could not start the session.", ok: false, tone: "error" };
  }
  const body = (await create.json()) as { event: { id: string } };

  await fetch(`/api/axis/events/${body.event.id}`, {
    body: JSON.stringify({ start_clock: true, status: "live" }),
    headers: { "Content-Type": "application/json" },
    method: "PATCH",
  }).catch(() => null);

  return { id: body.event.id, ok: true };
}
