import { createClient } from "@supabase/supabase-js";
import {
  axisServerSupabaseOptions,
  getAxisSupabaseServerEnv,
} from "./axis-supabase-server";

export type AxisPersistedRole = "user" | "assistant";

export type AxisPersistedThreadBoard = {
  title: string;
  summary: string;
  sections: Array<{
    type: string;
    label: string;
    items: string[];
  }>;
};

export type AxisThreadMessageInput = {
  ordinal: number;
  role: AxisPersistedRole;
  content: string;
  threadBoard?: AxisPersistedThreadBoard | null;
};

export type AxisThreadSummary = {
  id: string;
  title: string;
  updatedAt: string;
  lastOpenedAt: string | null;
  latestPreview: string;
};

export type AxisThreadMessage = {
  id: string;
  ordinal: number;
  role: AxisPersistedRole;
  content: string;
  threadBoard: AxisPersistedThreadBoard | null;
  createdAt: string;
};

export type AxisThreadRecord = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string | null;
  messages: AxisThreadMessage[];
};

type AxisThreadRow = {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  last_opened_at: string | null;
  axis_thread_messages?: Array<{
    content: string;
  }>;
};

type AxisThreadMessageRow = {
  id: string;
  ordinal: number;
  role: AxisPersistedRole;
  content: string;
  thread_board: AxisPersistedThreadBoard | null;
  created_at: string;
};

type AxisThreadPersistenceResult<T> =
  | { ok: true; value: T }
  | { error: string; ok: false };

function getAxisThreadClient() {
  const env = getAxisSupabaseServerEnv();
  if (!env.ok) return null;
  return createClient(env.url, env.key, axisServerSupabaseOptions);
}

export async function listAxisThreads(
  ownerId: string,
): Promise<AxisThreadPersistenceResult<AxisThreadSummary[]>> {
  const supabase = getAxisThreadClient();
  if (!supabase) return { error: "Supabase is not configured.", ok: false };

  const { data, error } = await supabase
    .from("axis_threads")
    .select("id,title,updated_at,last_opened_at,axis_thread_messages(content)")
    .eq("owner_id", ownerId)
    .is("archived_at", null)
    .order("updated_at", { ascending: false })
    .order("ordinal", {
      ascending: false,
      foreignTable: "axis_thread_messages",
    })
    .limit(20)
    .limit(1, { foreignTable: "axis_thread_messages" });

  if (error) return { error: error.message, ok: false };

  return {
    ok: true,
    value: ((data ?? []) as AxisThreadRow[]).map((row) => ({
      id: row.id,
      title: row.title || "Untitled Axis Thread",
      updatedAt: row.updated_at,
      lastOpenedAt: row.last_opened_at,
      latestPreview: row.axis_thread_messages?.[0]?.content ?? "",
    })),
  };
}

export async function createAxisThread({
  messages = [],
  ownerId,
  title,
}: {
  messages?: AxisThreadMessageInput[];
  ownerId: string;
  title: string;
}): Promise<AxisThreadPersistenceResult<AxisThreadRecord>> {
  const supabase = getAxisThreadClient();
  if (!supabase) return { error: "Supabase is not configured.", ok: false };

  const now = new Date().toISOString();
  const { data: thread, error: threadError } = await supabase
    .from("axis_threads")
    .insert({
      owner_id: ownerId,
      title: title.trim() || "Untitled Axis Thread",
      created_at: now,
      updated_at: now,
      last_opened_at: now,
    })
    .select("id,title,created_at,updated_at,last_opened_at")
    .single();

  if (threadError || !thread) {
    return { error: threadError?.message ?? "Thread could not be created.", ok: false };
  }

  if (messages.length > 0) {
    const saved = await saveAxisThreadMessages({
      messages,
      ownerId,
      threadId: thread.id,
    });
    if (!saved.ok) return saved;
  }

  const record = await getAxisThread({ ownerId, threadId: thread.id });
  return record.ok ? record : { error: record.error, ok: false };
}

export async function getAxisThread({
  ownerId,
  threadId,
}: {
  ownerId: string;
  threadId: string;
}): Promise<AxisThreadPersistenceResult<AxisThreadRecord>> {
  const supabase = getAxisThreadClient();
  if (!supabase) return { error: "Supabase is not configured.", ok: false };

  const openedAt = new Date().toISOString();
  await supabase
    .from("axis_threads")
    .update({ last_opened_at: openedAt })
    .eq("id", threadId)
    .eq("owner_id", ownerId);

  const { data: thread, error: threadError } = await supabase
    .from("axis_threads")
    .select("id,title,created_at,updated_at,last_opened_at")
    .eq("id", threadId)
    .eq("owner_id", ownerId)
    .is("archived_at", null)
    .maybeSingle();

  if (threadError) return { error: threadError.message, ok: false };
  if (!thread) return { error: "Thread not found.", ok: false };

  const { data: messages, error: messagesError } = await supabase
    .from("axis_thread_messages")
    .select("id,ordinal,role,content,thread_board,created_at")
    .eq("thread_id", threadId)
    .eq("owner_id", ownerId)
    .order("ordinal", { ascending: true });

  if (messagesError) return { error: messagesError.message, ok: false };

  return {
    ok: true,
    value: {
      id: thread.id,
      title: thread.title || "Untitled Axis Thread",
      createdAt: thread.created_at,
      updatedAt: thread.updated_at,
      lastOpenedAt: thread.last_opened_at,
      messages: ((messages ?? []) as AxisThreadMessageRow[]).map((message) => ({
        id: message.id,
        ordinal: message.ordinal,
        role: message.role,
        content: message.content,
        threadBoard: message.thread_board,
        createdAt: message.created_at,
      })),
    },
  };
}

export async function saveAxisThreadMessages({
  messages,
  ownerId,
  threadId,
}: {
  messages: AxisThreadMessageInput[];
  ownerId: string;
  threadId: string;
}): Promise<AxisThreadPersistenceResult<null>> {
  const supabase = getAxisThreadClient();
  if (!supabase) return { error: "Supabase is not configured.", ok: false };

  const safeMessages = messages
    .filter(
      (message) =>
        Number.isInteger(message.ordinal) &&
        message.ordinal > 0 &&
        (message.role === "user" || message.role === "assistant") &&
        message.content.trim(),
    )
    .map((message) => ({
      content: message.content,
      owner_id: ownerId,
      ordinal: message.ordinal,
      role: message.role,
      thread_board: message.threadBoard ?? null,
      thread_id: threadId,
    }));

  if (safeMessages.length === 0) return { ok: true, value: null };

  const { data: thread, error: threadError } = await supabase
    .from("axis_threads")
    .select("id")
    .eq("id", threadId)
    .eq("owner_id", ownerId)
    .is("archived_at", null)
    .maybeSingle();

  if (threadError) return { error: threadError.message, ok: false };
  if (!thread) return { error: "Thread not found.", ok: false };

  const { error } = await supabase
    .from("axis_thread_messages")
    .upsert(safeMessages, { onConflict: "thread_id,ordinal" });

  if (error) return { error: error.message, ok: false };

  const latestOrdinal = Math.max(...safeMessages.map((message) => message.ordinal));
  const latestContent = safeMessages.find((message) => message.ordinal === latestOrdinal)?.content;
  const update: { title?: string; updated_at: string } = {
    updated_at: new Date().toISOString(),
  };
  if (latestOrdinal === 1 && latestContent) update.title = makeThreadTitle(latestContent);

  const { error: updateError } = await supabase
    .from("axis_threads")
    .update(update)
    .eq("id", threadId)
    .eq("owner_id", ownerId);

  if (updateError) return { error: updateError.message, ok: false };

  return { ok: true, value: null };
}

export function makeThreadTitle(message: string) {
  const clean = message.trim().replace(/\s+/g, " ");
  if (!clean) return "Untitled Axis Thread";
  return clean.length > 52 ? `${clean.slice(0, 49).trim()}...` : clean;
}
