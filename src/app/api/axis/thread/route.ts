export const runtime = "nodejs";

import {
  createSupabaseFromRequest,
  type AxisCard,
  type AxisEvent,
  type AxisThread,
  type SidebarThread,
} from "../../../../lib/axis-server";

interface RestoredConversation {
  id: string;
  userMessage: string;
  cards: AxisCard[];
  timestamp: string;
}

function pairEvents(events: AxisEvent[]): RestoredConversation[] {
  const conversations: RestoredConversation[] = [];
  let pendingUser: AxisEvent | null = null;

  for (const evt of events) {
    if (evt.role === "user") {
      if (pendingUser) {
        const content = pendingUser.content as { message?: string; fileName?: string };
        const msg = content.message || (content.fileName ? `[${content.fileName}]` : "");
        if (msg) {
          conversations.push({
            id: pendingUser.id,
            userMessage: msg,
            cards: [],
            timestamp: pendingUser.created_at,
          });
        }
      }
      pendingUser = evt;
      continue;
    }

    if (evt.role !== "assistant" || !pendingUser) continue;

    const userContent = pendingUser.content as { message?: string; fileName?: string };
    const msg = userContent.message || (userContent.fileName ? `[${userContent.fileName}]` : "");
    if (!msg) {
      pendingUser = null;
      continue;
    }

    const cards = (evt.content as { cards?: AxisCard[] }).cards ?? [];
    conversations.push({
      id: pendingUser.id,
      userMessage: msg,
      cards,
      timestamp: pendingUser.created_at,
    });
    pendingUser = null;
  }

  if (pendingUser) {
    const content = pendingUser.content as { message?: string; fileName?: string };
    const msg = content.message || (content.fileName ? `[${content.fileName}]` : "");
    if (msg) {
      conversations.push({
        id: pendingUser.id,
        userMessage: msg,
        cards: [],
        timestamp: pendingUser.created_at,
      });
    }
  }

  return conversations;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const threadId = url.searchParams.get("id");
  if (!threadId) return Response.json({ error: "Missing id" }, { status: 400 });

  const sb = createSupabaseFromRequest(req);

  const [{ data: thread }, { data: eventRows }, { data: sidebarData }] =
    await Promise.all([
      sb.from("axis_threads").select("*").eq("id", threadId).single(),
      sb
        .from("axis_thread_events")
        .select("*")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true }),
      sb
        .from("axis_threads")
        .select("id, title, focus, current_bottleneck, updated_at")
        .order("updated_at", { ascending: false })
        .limit(30),
    ]);

  if (!thread) return Response.json({ error: "Not found" }, { status: 404 });

  const conversations = pairEvents((eventRows ?? []) as AxisEvent[]);

  return Response.json({
    thread,
    conversations,
    currentUnderstanding: (thread as AxisThread).current_understanding ?? null,
    sidebarThreads: (sidebarData ?? []) as SidebarThread[],
  });
}

export async function PATCH(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    id?: string;
    title?: string;
  } | null;
  const threadId = body?.id;
  const title = body?.title?.trim();

  if (!threadId) return Response.json({ error: "Missing id" }, { status: 400 });
  if (!title) return Response.json({ error: "Missing title" }, { status: 400 });

  const sb = createSupabaseFromRequest(req);
  const { data, error } = await sb
    .from("axis_threads")
    .update({ title, updated_at: new Date().toISOString() })
    .eq("id", threadId)
    .select("id, title, focus, current_bottleneck, updated_at")
    .single();

  if (error || !data) {
    return Response.json({ error: error?.message ?? "Rename failed" }, { status: 500 });
  }

  return Response.json({ thread: data as SidebarThread });
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const threadId = url.searchParams.get("id");
  if (!threadId) return Response.json({ error: "Missing id" }, { status: 400 });

  const sb = createSupabaseFromRequest(req);
  const { error } = await sb.from("axis_threads").delete().eq("id", threadId);

  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ ok: true });
}
