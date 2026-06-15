export const runtime = "nodejs";

import {
  createSupabaseFromRequest,
  type AxisCard,
  type AxisEvent,
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
  for (let i = 0; i < events.length; i++) {
    const evt = events[i];
    if (evt.role !== "user") continue;
    const msg = (evt.content as { message?: string }).message;
    if (!msg) continue;
    const next = events[i + 1];
    if (next?.role === "assistant") {
      const cards = (next.content as { cards?: AxisCard[] }).cards ?? [];
      conversations.push({
        id: evt.id,
        userMessage: msg,
        cards,
        timestamp: evt.created_at,
      });
      i++; // skip assistant event
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
    sidebarThreads: (sidebarData ?? []) as SidebarThread[],
  });
}
