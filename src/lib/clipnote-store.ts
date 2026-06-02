// ─── Types ────────────────────────────────────────────────────────────────────

export type Tag = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
};

export type Flag = {
  id: string;
  session_id: string;
  timestamp: number;
  created_at: string;
  converted_to_clipnote_id?: string;
};

export type Clipnote = {
  id: string;
  session_id: string;
  flag_id?: string;
  open_time: number;
  close_time: number;
  title: string;
  tag_id?: string;
  custom_note?: string;
  thumbnail_url?: string;
  clip_url?: string;
  created_at: string;
};

export type Session = {
  id: string;
  title: string;
  source_video_url?: string; // ephemeral blob URL — never persisted to localStorage
  mux_playback_id?: string;
  created_at: string;
  status: "active" | "complete";
  flags: Flag[];
  clipnotes: Clipnote[];
};

export type Stack = {
  tag_id: string;
  tag_name: string;
  tag_slug: string;
  count: number;
};

export type DatasetBin = {
  tag_id: string;
  tag_name: string;
  tag_slug: string;
  clipnote_count: number;
};

// ─── SQL schema (for future Supabase migration) ───────────────────────────────
//
// create table tags (
//   id uuid default gen_random_uuid() primary key,
//   name text not null,
//   slug text not null unique,
//   created_at timestamptz default now() not null
// );
//
// create table sessions (
//   id uuid default gen_random_uuid() primary key,
//   title text not null,
//   source_video_url text,
//   mux_playback_id text,
//   created_at timestamptz default now() not null,
//   status text not null default 'active' check (status in ('active', 'complete'))
// );
//
// create table flags (
//   id uuid default gen_random_uuid() primary key,
//   session_id uuid references sessions(id) on delete cascade not null,
//   timestamp float not null,
//   created_at timestamptz default now() not null,
//   converted_to_clipnote_id uuid
// );
//
// create table clipnotes (
//   id uuid default gen_random_uuid() primary key,
//   session_id uuid references sessions(id) on delete cascade not null,
//   flag_id uuid references flags(id) on delete set null,
//   open_time float not null,
//   close_time float not null,
//   title text not null,
//   tag_id uuid references tags(id) on delete set null,
//   custom_note text,
//   thumbnail_url text,
//   clip_url text,
//   created_at timestamptz default now() not null
// );
//
// create or replace view stacks as
//   select t.id as tag_id, t.name as tag_name, t.slug as tag_slug, count(c.id)::int as count
//   from tags t left join clipnotes c on c.tag_id = t.id
//   group by t.id, t.name, t.slug
//   having count(c.id) > 0
//   order by count desc;
//
// create or replace view dataset_bins as
//   select
//     t.id as tag_id,
//     t.name as tag_name,
//     t.slug as tag_slug,
//     count(c.id)::int as clipnote_count
//   from tags t left join clipnotes c on c.tag_id = t.id
//   group by t.id, t.name, t.slug
//   having count(c.id) > 0
//   order by clipnote_count desc;

// ─── Storage ──────────────────────────────────────────────────────────────────

const SESSIONS_KEY = "cn-sessions";
const TAGS_KEY = "cn-tags";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota errors
  }
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

export function getSessions(): Session[] {
  return read<Session[]>(SESSIONS_KEY, []);
}

export function getSession(id: string): Session | null {
  return getSessions().find((s) => s.id === id) ?? null;
}

export function saveSession(session: Session): void {
  // Strip ephemeral blob URL before persisting
  const { source_video_url: _url, ...rest } = session;
  const toSave = rest as Session;

  const sessions = getSessions();
  const i = sessions.findIndex((s) => s.id === session.id);
  if (i >= 0) {
    sessions[i] = toSave;
  } else {
    sessions.unshift(toSave);
  }
  write(SESSIONS_KEY, sessions);
}

export function createSession(title: string): Session {
  const session: Session = {
    id: `s-${Date.now()}`,
    title,
    created_at: new Date().toISOString(),
    status: "active",
    flags: [],
    clipnotes: [],
  };
  saveSession(session);
  return session;
}

export function updateSessionTitle(id: string, title: string): void {
  const session = getSession(id);
  if (!session) return;
  saveSession({ ...session, title: title.trim() || session.title });
}

export function completeSession(id: string): void {
  const session = getSession(id);
  if (!session) return;
  saveSession({ ...session, status: "complete" });
}

// ─── Flags ────────────────────────────────────────────────────────────────────

export function addFlag(sessionId: string, timestamp: number): Flag {
  const session = getSession(sessionId);
  if (!session) throw new Error(`Session ${sessionId} not found`);

  const flag: Flag = {
    id: `f-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    session_id: sessionId,
    timestamp: Math.max(0, timestamp),
    created_at: new Date().toISOString(),
  };

  saveSession({ ...session, flags: [...session.flags, flag] });
  return flag;
}

// ─── Clipnotes ────────────────────────────────────────────────────────────────

export function saveClipnote(clipnote: Clipnote): void {
  const session = getSession(clipnote.session_id);
  if (!session) return;

  const clipnotes = [
    ...session.clipnotes.filter((c) => c.id !== clipnote.id),
    clipnote,
  ];
  const flags = session.flags.map((f) =>
    f.id === clipnote.flag_id
      ? { ...f, converted_to_clipnote_id: clipnote.id }
      : f,
  );

  saveSession({ ...session, clipnotes, flags });
}

export function getClipnote(
  clipnoteId: string,
): { clipnote: Clipnote; session: Session } | null {
  for (const session of getSessions()) {
    const clipnote = session.clipnotes.find((c) => c.id === clipnoteId);
    if (clipnote) return { clipnote, session };
  }
  return null;
}

// ─── Tags ─────────────────────────────────────────────────────────────────────

export function getTags(): Tag[] {
  return read<Tag[]>(TAGS_KEY, []);
}

export function getTag(id: string): Tag | null {
  return getTags().find((t) => t.id === id) ?? null;
}

export function createTag(name: string): Tag {
  const tags = getTags();
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const existing = tags.find((t) => t.slug === slug);
  if (existing) return existing;

  const tag: Tag = {
    id: `t-${Date.now()}`,
    name: name.trim(),
    slug,
    created_at: new Date().toISOString(),
  };
  write(TAGS_KEY, [...tags, tag]);
  return tag;
}

// ─── Stacks (derived) ─────────────────────────────────────────────────────────

export function getStacks(): Stack[] {
  return getDatasetBins().map((bin) => ({
    tag_id: bin.tag_id,
    tag_name: bin.tag_name,
    tag_slug: bin.tag_slug,
    count: bin.clipnote_count,
  }));
}

export function getDatasetBins(): DatasetBin[] {
  const tags = getTags();
  const sessions = getSessions();

  const counts = new Map<string, number>();
  for (const session of sessions) {
    for (const cn of session.clipnotes) {
      if (cn.tag_id) {
        counts.set(cn.tag_id, (counts.get(cn.tag_id) ?? 0) + 1);
      }
    }
  }

  return tags
    .filter((t) => (counts.get(t.id) ?? 0) > 0)
    .map((t) => ({
      tag_id: t.id,
      tag_name: t.name,
      tag_slug: t.slug,
      clipnote_count: counts.get(t.id) ?? 0,
    }))
    .sort((a, b) => b.clipnote_count - a.clipnote_count);
}

// ─── Video URL cache (sessionStorage — survives navigation, not reload) ───────

export function cacheVideoUrl(sessionId: string, url: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(`cn-video-${sessionId}`, url);
  } catch {
    // ignore
  }
}

export function getCachedVideoUrl(sessionId: string): string {
  if (typeof window === "undefined") return "";
  return window.sessionStorage.getItem(`cn-video-${sessionId}`) ?? "";
}
