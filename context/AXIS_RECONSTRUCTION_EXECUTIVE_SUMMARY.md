# AXIS RECONSTRUCTION: EXECUTIVE SUMMARY

**Principal Systems Architecture Review**  
**Date**: 2026-06-07

---

## THE PROBLEM

Axis currently conflates two distinct product directions:

1. **Continuity System**: Check-in → Participation → History → Leaderboard → Return
2. **Reconstruction Platform**: Upload Video → Create Events → Replay → Draw Overlays → Share

The continuity system is stable and working. The reconstruction platform is dormant, fragmented across legacy tables, and architecturally confused about what it's trying to be.

Current state:
- Multiple event tables (old `events`, `axis_events`, game-state `game_events`)
- Scattered session/timeline concepts
- CV treated as mandatory (it's not)
- No unified time primitive
- Duplicate storage patterns

**Result**: Cannot rebuild reconstruction cleanly without disrupting continuity.

---

## THE SOLUTION

Redesign reconstruction from first principles using three core primitives:

| Primitive | Definition | Ownership |
|-----------|-----------|-----------|
| **Evidence** | Raw video file + metadata (immutable) | Mux (source of truth) |
| **Events** | Discrete semantic moments (timestamp + type + metadata) | User-created, CV-assisted |
| **Time** | Immutable timeline anchoring all outputs | Single per recording |

This is a **4-layer foundation**:

```
Reconstruction Platform
├── Teaching Surface (clips, narratives, sharing)
├── Reconstruction & Overlay Render (compose evidence + events + overlays)
├── Timeline Query Engine (fast time-aligned lookups)
└── Evidence + Event + Overlay Persistence (3 tables, 1 timeline)
```

**Critical**: CV enters as an *optional acceleration layer* (Phase 8), not as the foundation.

---

## WHY THIS WORKS

### No Duplicates
- **One recording per session** (Mux → Supabase)
- **One event table** (not scattered across `events`, `axis_events`, `game_events`)
- **One overlay table** (new, clean)
- **One timeline** (milliseconds from recording start)
- **All queries join on timestamp only**

### Independent Layers
Each layer has:
- Single responsibility
- Own table(s)
- Own CRUD API
- Own tests
- Can develop in parallel
- Zero dependencies on CV

### No Architectural Confusion
Clear answer to every question:

| Question | Answer | Table |
|----------|--------|-------|
| Where's the video? | Mux + axis_sessions | `axis_sessions.mux_playback_id` |
| Where are events? | One table | `axis_events` (indexed by timestamp) |
| Where are overlays? | One table | `axis_overlays` (indexed by timestamp) |
| How do I replay? | Query timeslice, render canvas | `GetTimeslice(session_id, timestamp_ms, window_ms)` |
| Can I use this without CV? | Yes, completely | Manual + UI authoring |
| Can I add CV later? | Yes, zero schema changes | Optional `POST /cv-analyze` |

---

## BUILD ORDER (8 WEEKS)

| Week | Layer | Input | Output |
|------|-------|-------|--------|
| 1 | Evidence | Video file | Mux URL + session metadata |
| 2 | Events | Manual form | Event CRUD API + indexed queries |
| 3 | Overlays | Canvas tool | Overlay CRUD API + indexed queries |
| 4 | Timeline | Timeslice query | Fast unified (session + events + overlays) |
| 5 | Render | Replay UI | Video + synchronized overlays |
| 6 | Authoring | Event/overlay creation | Manual UI with keyboard shortcuts |
| 7 | Teaching | Clip creation | Shareable clips with narrative |
| 8+ | CV (Optional) | Roboflow + ByteTrack | Auto-suggested events + overlays |

**Each phase is independent.** Phases 2-8 can develop in parallel after Phase 1 complete.

---

## RISKS & MITIGATIONS

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Timestamp sync drift | Video/overlay mismatch visible to user | Use video.currentTime as truth, throttle redraws, test extensively |
| Many overlays (100+) | Canvas performance degradation | Batch rendering, level-of-detail, measure frame rate |
| CV accuracy (future) | Users distrust suggestions | Manual review required, confidence scores, A/B testing |
| Mux outage | Cannot upload/play | Local preview, fallback storage, graceful degradation |
| Schema migration | Data loss during transition | Export old data, transform, validate, keep old tables read-only 1 week |
| Duplicate event data | Breaks reproducibility | Code review, single-table enforcement, schema guards |

**Highest severity**: Timestamp sync drift, duplicate event data. Both preventable with discipline.

---

## WHAT TO DELETE

### Delete Immediately (Abandoned Products)
- Game-state tables: `teams`, `players`, `game_sessions`, `game_players`, `game_events`, `lineup_segments`, `sub_events`, `review_marks`
- Empty buckets: `game-film`, `session-snapshots`, `training-frames`
- Archived routes: `/axis-shell`, `/replay-native`, `/game-day`, `/games`, `/cv-demo`, `/rf-test`, `/measures`
- Dead APIs: `/api/live/*`, `/api/training-memory/*`, `/api/roboflow/upload-training-frame`

### Archive (Keep Hidden)
- Old event tables: `sessions` (old live), `events` (old chronology), `snapshots`, `training_memories`
- Dormant infrastructure: `axis_behavioral_memory`, `axis_session_analysis`
- Action: Export data, migrate to new schema, deprecate old tables

### Fix Security Policies
- `axis_sessions`: Currently `allow all`. Fix to require auth or service-role.
- Game-state tables: Remove public policies or delete tables.

**Action**: Backup first. Fix policies before deleting.

---

## SCHEMA SUMMARY

### New Tables Required

#### `axis_overlays`
```sql
CREATE TABLE axis_overlays (
  id UUID PRIMARY KEY,
  session_id UUID NOT NULL,
  timestamp_ms BIGINT NOT NULL,
  overlay_type TEXT NOT NULL,
  geometry JSONB NOT NULL,
  styling JSONB,
  created_by UUID,
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_overlays_session_timestamp 
  ON axis_overlays(session_id, timestamp_ms);
```

#### `axis_clips`
```sql
CREATE TABLE axis_clips (
  id UUID PRIMARY KEY,
  session_id UUID NOT NULL,
  start_timestamp_ms BIGINT NOT NULL,
  end_timestamp_ms BIGINT NOT NULL,
  title TEXT,
  description TEXT,
  overlay_selection JSONB,
  event_selection JSONB,
  share_url TEXT UNIQUE,
  is_public BOOLEAN DEFAULT false,
  created_by UUID,
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_clips_share_url ON axis_clips(share_url);
```

### Existing Tables to Update

#### `axis_sessions` (expand)
- Ensure `mux_asset_id`, `mux_playback_id`, `recording_url` are clean
- Add `duration_ms`, `frame_rate_hz`, `resolution_width`, `resolution_height`
- Verify RLS policy (user_id match or service-role)

#### `axis_events` (keep as-is)
- Verify index: `(session_id, timestamp_ms)`
- Verify RLS policy consistent with sessions
- No schema changes

---

## SUCCESS CRITERIA

1. ✅ **Minimal**: No feature duplicates another layer.
2. ✅ **Fast**: Timeslice queries <50ms. Sync drift <100ms over 30 min.
3. ✅ **Independent**: Each layer testable in isolation.
4. ✅ **Extensible**: CV layer requires zero schema changes.
5. ✅ **Operational**: Upload → Create events → Playback → Share in <10 min per session.

---

## CONTINUITY LOOP PRESERVATION

**This design does NOT impact the active continuity loop:**

- ✅ Check-in/Check-out: Unchanged
- ✅ Effort hours: Unchanged
- ✅ Streaks: Unchanged
- ✅ Leaderboard: Unchanged
- ✅ Organization memberships: Unchanged
- ✅ Clerk auth: Unchanged

The reconstruction platform is a **separate product layer** that lives underneath and never interferes with participation/progression/history/leaderboard.

When reconstruction is stable, it becomes optional infrastructure that supports:
- "Every rep becomes a clip" (teaching surface)
- "Every clip becomes a report" (future analytics)
- "Every report becomes progress" (leaderboard annotations)

But none of those are required for the core loop to work.

---

## ARCHITECTURAL INVARIANTS

**Always maintain:**
1. Single timeline per recording (immutable)
2. Single event table per concept (no copies)
3. Single overlay table (no copies)
4. All queries time-anchored
5. Evidence → Events → Overlays → Render dependency order
6. CV as optional acceleration layer
7. Each layer independently testable
8. Zero impact on continuity loop

**Never allow:**
- Duplicate event data across tables
- Joins on anything other than timestamp
- Computed overlays stored (draw on demand)
- CV required to use reconstruction
- Hardcoded time sync (make parameterizable)
- Tables added without eliminating old equivalents

---

## NEXT STEPS

1. **Review this architecture** with product, design, and data teams
2. **Create migration plan** for old → new event/overlay tables
3. **Backup existing schema** (before any destructive changes)
4. **Fix security policies** on `axis_sessions` (before moving forward)
5. **Delete or archive** game-state tables and abandoned routes
6. **Begin Phase 1**: Evidence layer (upload video, store metadata)
7. **Run Phase 1 verification** before proceeding to Phase 2

---

## CONCLUSION

Axis Reconstruction is a **four-layer foundation** built on **three immutable primitives** (Evidence, Events, Time).

This design:
- ✅ Eliminates architectural confusion
- ✅ Removes all duplicate concepts
- ✅ Makes each layer independently testable
- ✅ Allows CV to be added later without schema changes
- ✅ Preserves the continuity loop untouched
- ✅ Enables teaching and narrative surfaces

**Timeline**: 8 weeks to full operational reconstruction platform (including optional CV).

**Risk**: Moderate (mostly around timestamp sync and schema migration, both preventable).

**Confidence**: High (design is minimal, dependencies are clear, each layer has proven patterns).

Ready to rebuild.
