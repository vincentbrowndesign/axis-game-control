# AXIS RECONSTRUCTION ARCHITECTURE

**Status**: Principal Systems Redesign  
**Date**: 2026-06-07  
**Scope**: Rebuild reconstruction and overlay platform from first principles.

---

## THESIS

Axis is not an analytics platform.

Axis is a reconstruction and overlay platform.

**Core Primitives:**
- **Evidence**: Raw video with complete temporal and geometric metadata
- **Events**: Discrete semantic moments anchored to precise timestamps
- **Time**: Unified timeline that synchronizes evidence, events, and outputs

**Core Outputs:**
- **Reconstruction**: Annotated video replaying captured moments
- **Overlays**: Visual layers (tracking, geometry, metrics) synchronized to video
- **Teaching**: Shareable clips with context, overlays, and narrative

**Constraint**: CV is an *input layer*, not the foundation.

The architecture must support all five core capabilities *without* requiring computer vision. CV enters later as a convenience layer that accelerates event creation, not as a architectural dependency.

---

## CORE CONCEPTS

### Evidence

Raw input material.

| Concept | Definition | Persistence | Ownership |
|---------|-----------|-------------|-----------|
| **Recording** | Complete video file with stream metadata | Mux (source of truth) | Session |
| **Session** | Recording + metadata container + timestamps | Supabase | User |
| **Frame Reference** | Discrete video frame identified by timestamp + index | Computed (not stored) | Recording |

**Evidence Rules:**
- One Recording per Session.
- Recording timestamp is immutable ground truth.
- All Events are timestamped relative to Recording start.
- All Overlays reference Frame References.
- No duplicate video storage.

### Events

Semantic moments anchored to precise time.

| Concept | Definition | Persistence | Ownership |
|---------|-----------|-------------|-----------|
| **Event** | (timestamp, type, metadata) tuple | Supabase | Session |
| **Event Type** | Enumeration: `shot_attempt`, `made_shot`, `missed_shot`, `player_entry`, `player_exit`, `turnover`, etc. | Schema | System |
| **Event Metadata** | Type-specific properties (player_id, location, etc.) | JSON | Event |

**Event Rules:**
- Every Event has a single precise timestamp (not a duration).
- Events are independent semantic facts, not derived analysis.
- Events are manually created (or CV-assisted, but not required).
- Events are not stored multiple times across tables.
- Events never duplicate another table's primary data.

### Time

Unified timeline anchoring evidence, events, and outputs.

| Concept | Definition | Resolution | Immutability |
|---------|-----------|-----------|--------------|
| **Timeline** | Video timestamp from Recording start | Millisecond (1000 fps native) | Immutable |
| **Alignment** | All reconstructions and overlays are time-aligned to this single timeline | Automatic | System-enforced |
| **Query Primitive** | `(session_id, timestamp_ms) → [events, overlays, frames]` | O(log n) index | By design |

**Time Rules:**
- One immutable timeline per Recording.
- All Events, Overlays, and Frame References use this single timeline.
- Timeline is the join key. No other join logic needed.
- Time-based queries must be indexed and fast.

---

## SYSTEM ARCHITECTURE

### Layer Stack

```
┌─────────────────────────────────────────┐
│       Teaching Surface                  │
│  (clips, narratives, sharing)           │
└────────────────────┬────────────────────┘
                     │
┌────────────────────▼────────────────────┐
│     Reconstruction & Overlay Render     │
│  (compose events + overlays over video) │
└────────────────────┬────────────────────┘
                     │
┌────────────────────▼────────────────────┐
│   Authoring Layer (Manual + CV-Assisted)│
│  (create/edit events, draw overlays)    │
└────────────────────┬────────────────────┘
                     │
┌────────────────────▼────────────────────┐
│        Timeline Query Engine            │
│  (fast event/overlay lookup by time)    │
└────────────────────┬────────────────────┘
                     │
┌────────────────────▼────────────────────┐
│    Evidence + Event Persistence         │
│  (Supabase tables, Mux storage)         │
└─────────────────────────────────────────┘
```

### Layer Definitions

#### 1. Evidence Layer (Immutable)

**Responsibility**: Store and serve raw video with metadata.

**Components**:
- `Recording` entity: video metadata, duration, resolution, frame rate, source
- `Session` entity: recording, user, timestamps, session-level context
- Mux integration: upload, playback URL, storage
- Storage query: "get video bytes for playback"

**Dependencies**:
- Mux API
- Supabase `axis_sessions`, `axis_uploads`

**Testability**:
- Upload a recording, verify Mux URL stored
- Query by session_id, verify recording metadata
- Stream playback, verify byte ranges

**No CV needed.**

---

#### 2. Event Layer (Semantic Facts)

**Responsibility**: Create, persist, and query semantic moments.

**Components**:
- `Event` table schema:
  - `id`: UUID
  - `session_id`: FK to sessions
  - `timestamp_ms`: milliseconds from recording start (indexed)
  - `event_type`: enum (`shot_attempt`, `made_shot`, etc.)
  - `metadata`: JSON (player_id, location, etc.)
  - `created_by`: user_id
  - `created_at`: auto timestamp
  
- Event CRUD API:
  - Create: `POST /api/sessions/{id}/events` with (timestamp_ms, type, metadata)
  - Read: `GET /api/sessions/{id}/events?timestamp_range=[start, end]`
  - Update: `PATCH /api/sessions/{id}/events/{event_id}`
  - Delete: `DELETE /api/sessions/{id}/events/{event_id}`

- Event indexing:
  - `(session_id, timestamp_ms)` composite index for range queries
  - Single event table, no duplicates

**Dependencies**:
- Supabase `axis_events` table
- Evidence layer (session existence)

**Testability**:
- Insert events, verify timestamp ordering
- Query by time range, verify correctness
- Delete event, verify removal

**No CV needed.**

---

#### 3. Overlay Layer (Visual Annotations)

**Responsibility**: Store geometric and visual annotations synchronized to time.

**Components**:
- `Overlay` table schema:
  - `id`: UUID
  - `session_id`: FK to sessions
  - `timestamp_ms`: milliseconds from recording start (indexed)
  - `overlay_type`: enum (`tracking_box`, `trajectory`, `court_marking`, `metric_label`, etc.)
  - `geometry`: JSON (points, paths, regions, text)
  - `styling`: JSON (color, stroke, opacity, etc.)
  - `created_by`: user_id
  - `created_at`: auto timestamp

- Overlay CRUD API:
  - Create: `POST /api/sessions/{id}/overlays` with (timestamp_ms, type, geometry, styling)
  - Read: `GET /api/sessions/{id}/overlays?timestamp_range=[start, end]`
  - Update: `PATCH /api/sessions/{id}/overlays/{overlay_id}`
  - Delete: `DELETE /api/sessions/{id}/overlays/{overlay_id}`

- Overlay indexing:
  - `(session_id, timestamp_ms)` composite index for range queries
  - Single overlay table, no duplicates

**Dependencies**:
- Supabase `axis_overlays` table (new)
- Evidence layer (session existence)
- Timeline (for synchronization)

**Testability**:
- Insert overlay, verify geometry stored correctly
- Query by time, verify overlay appears at correct moment
- Render overlay on canvas, verify positioning

**No CV needed.**

---

#### 4. Timeline Query Engine

**Responsibility**: Fast unified queries across evidence, events, and overlays.

**Components**:
- Query primitive:
  ```
  GetTimeslice(session_id, timestamp_ms, window_ms)
  → {
      session_metadata,
      events: [Event],
      overlays: [Overlay],
      playback_url: String,
      frame_info: {timestamp_ms, frame_index}
    }
  ```

- Implementation:
  - Parallel queries: session lookup + event range query + overlay range query
  - Results merged by timestamp
  - Caching by (session_id, timestamp_ms, window_ms)

- API route: `GET /api/sessions/{id}/timeslice?timestamp_ms=1000&window_ms=500`

**Dependencies**:
- Event layer (indexed query)
- Overlay layer (indexed query)
- Evidence layer (session lookup)

**Testability**:
- Query timeslice, verify all layers return data
- Verify timestamp ordering
- Verify cache hits/misses
- Performance: query should be <50ms for typical window

---

#### 5. Reconstruction & Overlay Render

**Responsibility**: Compose events and overlays over video for playback.

**Components**:
- **Canvas renderer** (browser):
  - Video element playing from Mux URL
  - Canvas overlay (absolute positioned, synchronized to video currentTime)
  - Draw overlays from `GetTimeslice()` response
  - Redraw on time update (throttled)

- **Replay player** component:
  - Accepts (session_id, start_time, end_time)
  - Fetches timeslices incrementally
  - Renders video + synchronized overlays
  - Timeline scrubber for seeking
  - Playback controls (play, pause, speed)

- **Overlay composition rules**:
  - Events → visual markers (event type icon, label)
  - Tracking overlays → rendered as rectangles or paths
  - Metric labels → rendered as text annotations
  - All synchronized to video.currentTime via timeline

**Dependencies**:
- Timeline query engine
- Evidence layer (Mux playback URL)
- Event layer (event visualization)
- Overlay layer (geometry visualization)

**Testability**:
- Play video, verify overlays appear at correct times
- Scrub timeline, verify overlays update correctly
- Verify no sync drift over long playback
- Test event type → visual marker mapping

**No CV needed.**

---

#### 6. Authoring Layer (Manual + CV-Assisted)

**Responsibility**: Create events and overlays (manually or with CV help).

**Manual Path:**
- UI form to create event: timestamp picker + event type + metadata
- UI form to draw overlay: canvas tool + geometry + styling
- Both submit to Event and Overlay CRUD APIs

**CV-Assisted Path (Future):**
- Upload recording to CV pipeline (Roboflow)
- CV returns suggested events (shot attempts, makes, misses)
- CV returns suggested overlays (player tracking, ball trajectory)
- User reviews and accepts/rejects suggestions
- Accepted suggestions written to Event and Overlay tables

**Current Implementation:**
- Only manual path required.
- CV integration scaffolding (routes reserved, APIs defined, not implemented).

**Dependencies**:
- Event layer
- Overlay layer
- Roboflow API (future)
- ByteTrack (future)

**Testability**:
- Create event manually, verify persisted
- Create overlay manually, verify persisted
- (Future) Submit to CV, verify suggestions returned
- (Future) Accept CV suggestion, verify written to table

---

#### 7. Teaching Surface

**Responsibility**: Create shareable clips with context and narrative.

**Components**:
- **Clip** table schema:
  - `id`: UUID
  - `session_id`: FK to sessions
  - `start_timestamp_ms`: clip start
  - `end_timestamp_ms`: clip end
  - `title`: String
  - `description`: String (narrative)
  - `overlay_selection`: JSON (which overlays to include)
  - `event_selection`: JSON (which events to highlight)
  - `created_by`: user_id
  - `share_url`: String (unique, shareable)

- Clip authoring:
  - Select time range from session
  - Choose which events/overlays to show
  - Add narrative
  - Save as clip

- Clip playback:
  - Render reconstruction with selected overlays
  - Show narrative alongside
  - Make shareable (public or org-scoped)

- Clip export:
  - Render as video file
  - Include overlays burned into video
  - Include title/narrative card

**Dependencies**:
- Reconstruction layer
- Event layer
- Overlay layer
- Mux (video composition API, future)

**Testability**:
- Create clip, verify saved
- Play clip, verify correct time range and overlays
- Share clip, verify URL works
- (Future) Export clip, verify video file

---

## DATA MODEL

### Core Tables (Supabase)

#### `axis_sessions` (existing, expand)
```sql
CREATE TABLE axis_sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  clerk_user_id TEXT,
  
  -- Evidence references
  mux_asset_id TEXT UNIQUE,
  mux_playback_id TEXT,
  recording_url TEXT,
  
  -- Metadata
  duration_ms BIGINT,
  frame_rate_hz INT,
  resolution_width INT,
  resolution_height INT,
  
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  
  FOREIGN KEY (user_id) REFERENCES axis_profiles(id)
);

CREATE INDEX idx_sessions_user_id ON axis_sessions(user_id);
```

#### `axis_events` (existing, unchanged)
```sql
CREATE TABLE axis_events (
  id UUID PRIMARY KEY,
  session_id UUID NOT NULL,
  
  timestamp_ms BIGINT NOT NULL,
  event_type TEXT NOT NULL,
  metadata JSONB,
  
  created_by UUID NOT NULL,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  
  FOREIGN KEY (session_id) REFERENCES axis_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES axis_profiles(id)
);

CREATE INDEX idx_events_session_timestamp 
  ON axis_events(session_id, timestamp_ms);
```

#### `axis_overlays` (new)
```sql
CREATE TABLE axis_overlays (
  id UUID PRIMARY KEY,
  session_id UUID NOT NULL,
  
  timestamp_ms BIGINT NOT NULL,
  overlay_type TEXT NOT NULL,
  geometry JSONB NOT NULL,
  styling JSONB,
  
  created_by UUID NOT NULL,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  
  FOREIGN KEY (session_id) REFERENCES axis_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES axis_profiles(id)
);

CREATE INDEX idx_overlays_session_timestamp 
  ON axis_overlays(session_id, timestamp_ms);
```

#### `axis_clips` (new)
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
  
  created_by UUID NOT NULL,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  
  FOREIGN KEY (session_id) REFERENCES axis_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES axis_profiles(id)
);

CREATE INDEX idx_clips_share_url ON axis_clips(share_url);
```

### No Duplicate Concepts

- **Single source of truth for video**: Mux asset + `axis_sessions`
- **Single event table**: `axis_events` (not replicated in legacy `events` or game state)
- **Single overlay table**: `axis_overlays` (new, not scattered)
- **Single timestamp primitive**: milliseconds from recording start
- **No derived copies**: All layers query the same tables

---

## BUILD ORDER

### Phase 1: Evidence Foundation (Week 1)

**Goals**: Upload video, store metadata, serve playback.

**Tasks**:
1. Verify `axis_sessions` schema and Mux integration
2. Create upload API: `POST /api/sessions` with video file
3. Test end-to-end: upload → Mux → playback URL stored
4. Create session query API: `GET /api/sessions/{id}`
5. Test playback in browser

**Deliverables**:
- Video upload working
- Session metadata persisted
- Playback URL correct
- Can play video in browser

**Risks**:
- Mux API limits
- Large file uploads
- Network timeouts

---

### Phase 2: Event Layer (Week 2)

**Goals**: Create, persist, and query events manually.

**Tasks**:
1. Verify `axis_events` schema and indexes
2. Create event CRUD API:
   - `POST /api/sessions/{id}/events` (create)
   - `GET /api/sessions/{id}/events` (list with time range)
   - `PATCH /api/sessions/{id}/events/{id}` (update)
   - `DELETE /api/sessions/{id}/events/{id}` (delete)
3. Test time-range queries
4. Create event type schema (enums)
5. Build simple event creation UI

**Deliverables**:
- Event CRUD API fully working
- Time-range queries fast (<50ms)
- Can create and view events in UI
- Event metadata flexible (JSON)

**Risks**:
- Index performance
- Timestamp precision
- Metadata validation

---

### Phase 3: Overlay Layer (Week 3)

**Goals**: Store and query geometric annotations.

**Tasks**:
1. Create `axis_overlays` table
2. Create overlay CRUD API:
   - `POST /api/sessions/{id}/overlays` (create)
   - `GET /api/sessions/{id}/overlays` (list with time range)
   - `PATCH /api/sessions/{id}/overlays/{id}` (update)
   - `DELETE /api/sessions/{id}/overlays/{id}` (delete)
3. Define overlay type enums (tracking box, trajectory, text, etc.)
4. Test geometry storage (JSON)
5. Build simple overlay creation UI (canvas tool)

**Deliverables**:
- Overlay CRUD API fully working
- Time-range queries fast
- Can draw overlays in UI
- Geometry stored correctly

**Risks**:
- Canvas coordinate mapping
- Geometry validation
- Styling options scope creep

---

### Phase 4: Timeline Query Engine (Week 4)

**Goals**: Fast unified queries across all layers.

**Tasks**:
1. Implement `GetTimeslice()` query:
   - Parallel session lookup + event range + overlay range
   - Merge results by timestamp
   - Return single response
2. Create API route: `GET /api/sessions/{id}/timeslice?timestamp_ms=X&window_ms=Y`
3. Add caching layer (Redis or in-memory)
4. Test performance: <50ms per query
5. Verify zero-copy/zero-duplication between layers

**Deliverables**:
- Timeslice query API working
- Performance validated (<50ms)
- Cache working
- No duplicate data in responses

**Risks**:
- Query optimization
- Cache invalidation
- Concurrent requests

---

### Phase 5: Reconstruction & Overlay Render (Week 5)

**Goals**: Playback video with synchronized overlays.

**Tasks**:
1. Build replay player component:
   - Video element (Mux URL)
   - Canvas overlay (absolute positioned)
   - Scrubber timeline
2. Integrate timeslice queries
3. Render overlays on canvas synchronized to currentTime
4. Implement time-sync logic (no drift over long playback)
5. Test scrubbing, seeking, slow-mo
6. Test event visualization (markers, labels)

**Deliverables**:
- Replay player fully functional
- Overlays synchronized to video
- No sync drift
- Scrubber and seeking work
- Events displayed with correct visualization

**Risks**:
- Video/canvas sync drift
- Canvas performance (many overlays)
- Mobile responsiveness

---

### Phase 6: Authoring Layer (Week 6)

**Goals**: Manual creation of events and overlays.

**Tasks**:
1. Build event creation modal:
   - Timestamp picker (sync to current video time)
   - Event type selector
   - Metadata form (player_id, location, etc.)
   - Submit to API
2. Build overlay drawing tools:
   - Rectangle tool
   - Line/path tool
   - Text tool
   - Color/opacity picker
   - Submit to API
3. Test undo/redo
4. Test validation (required fields, valid timestamps)
5. Create keystroke shortcuts

**Deliverables**:
- Event creation UI fully functional
- Overlay drawing tools fully functional
- Undo/redo working
- Can create multiple events/overlays quickly
- Keyboard shortcuts

**Risks**:
- Canvas drawing performance
- Undo/redo complexity
- UX intuitiveness (tools harder than expected)

---

### Phase 7: Teaching Surface (Week 7)

**Goals**: Create and share clips with narrative.

**Tasks**:
1. Create clip table schema
2. Build clip creation UI:
   - Select time range (visual scrubber)
   - Choose events/overlays to include
   - Add title and narrative
   - Save clip
3. Create clip playback surface:
   - Render reconstruction with selected overlays
   - Show narrative
   - Make shareable URL
4. Test clip sharing (public vs private)
5. (Optional) Implement clip export to video file

**Deliverables**:
- Clip creation working
- Clips can be shared
- Clip playback correct
- Narrative displayed
- (Optional) Video export

**Risks**:
- Video export complexity
- Sharing permissions
- Clip organization UX

---

### Phase 8: CV Integration (Week 8+)

**Goals**: Accelerate event/overlay creation with computer vision.

**Tasks**:
1. Define CV API contract:
   - Input: (session_id, recording URL)
   - Output: (events [], overlays [])
2. Integration points:
   - Route: `POST /api/sessions/{id}/cv-analyze`
   - Calls Roboflow for detection + ByteTrack for tracking
   - Returns suggested events (made, missed, attempted shots)
   - Returns suggested overlays (player boxes, ball trajectory)
3. Build review UI:
   - List CV suggestions
   - Accept/reject each
   - Bulk operations
4. Accepted suggestions → write to Event and Overlay tables
5. Test on real video

**Deliverables**:
- CV pipeline integrated
- Suggestions accurate
- Acceptance workflow fast
- Suggestions written to tables
- Can be disabled without breaking system

**Risks**:
- CV accuracy
- Latency
- Cost (Roboflow credits)
- User trust in suggestions

---

## DEPENDENCIES

### External Dependencies

| Service | Role | Why | Risk |
|---------|------|-----|------|
| **Mux** | Video storage & playback | Source of truth for film | API rate limits, cost, outage |
| **Supabase** | Evidence, Event, Overlay persistence | Single reliable database | Schema migration, query performance |
| **Roboflow** (future) | Detection | Event/overlay suggestions | Accuracy, latency, cost, availability |
| **ByteTrack** (future) | Identity persistence | Consistent player tracking | Implementation complexity |

### Internal Dependencies (Layering)

```
Teaching Surface
  ↓ depends on
Reconstruction & Overlay Render
  ↓ depends on
Timeline Query Engine
  ├─ depends on
  │ Event Layer
  ├─ depends on
  │ Overlay Layer
  └─ depends on
  │ Evidence Layer
```

**Order of implementation**: Evidence → Events → Overlays → Timeline → Render → Authoring → Teaching → CV

**Independence**: Each layer has independent tests and can be developed in parallel after Evidence is ready.

---

## RISKS & MITIGATIONS

### Risk 1: Duplicate Event/Overlay Data

**Problem**: Events or overlays accidentally stored in multiple tables.

**Mitigation**:
- Single table per concept (events, overlays)
- Code review enforces reads from single table
- Query layer rejects multi-table joins for events/overlays
- Schema guards: drop old tables after migration

**Severity**: HIGH (breaks reproducibility)

---

### Risk 2: Timestamp Sync Drift

**Problem**: Video plays at 24fps but overlay updates at 60fps, causing visual sync loss.

**Mitigation**:
- Use video.currentTime as source of truth
- Throttle overlay redraw to video frame rate (requestAnimationFrame)
- Test sync over 10+ minute recordings
- Measure drift, alert if > 100ms

**Severity**: HIGH (user-visible)

---

### Risk 3: Performance Degradation with Many Overlays

**Problem**: 100+ overlays per frame causes canvas rendering lag.

**Mitigation**:
- Implement overlay batching (draw only visible time window)
- Test with 100+ overlays, measure frame rate
- Use canvas context cache where possible
- Implement level-of-detail (show less detail at low zoom)

**Severity**: MEDIUM (degrades at scale)

---

### Risk 4: CV Accuracy (Future)

**Problem**: CV suggestions are wrong, users distrust system.

**Mitigation**:
- Require manual review/acceptance (do not auto-save CV results)
- Show confidence scores
- Gather user feedback on suggestions
- Fine-tune models on real Axis data
- Implement A/B testing

**Severity**: MEDIUM (affects user trust)

---

### Risk 5: Mux Dependency

**Problem**: Mux outage prevents video upload/playback.

**Mitigation**:
- Implement local video preview before upload (pre-validation)
- Implement fallback playback from Supabase storage
- Monitor Mux status, implement graceful degradation
- Cache playback URLs in browser

**Severity**: MEDIUM (affects core feature)

---

### Risk 6: Schema Migration Complexity

**Problem**: Migrating from old event/overlay tables to new single-table design causes data loss.

**Mitigation**:
- Export all old data first
- Create new tables, copy data with transformation
- Verify copy correctness
- Keep old tables in read-only mode for 1 week
- Then archive old tables

**Severity**: HIGH (irreversible)

---

## WHAT TO DELETE

### Delete Immediately

**These tables and routes support abandoned product directions:**

1. **Game-state tables** (no active code):
   - `teams`
   - `players`
   - `game_sessions`
   - `game_players`
   - `game_events`
   - `lineup_segments`
   - `sub_events`
   - `review_marks`

2. **Empty storage buckets**:
   - `game-film`
   - `session-snapshots`
   - `training-frames`

3. **Legacy routes** (disable or 404):
   - `/axis-shell`
   - `/replay-native`
   - `/game-day`
   - `/games`
   - `/cv-demo`
   - `/rf-test`
   - `/measures`

4. **Legacy API routes** (if unused):
   - `/api/live/*`
   - `/api/training-memory/*`
   - `/api/roboflow/upload-training-frame`

**Action**: Backup first, then delete after confirming no route references.

---

### Archive (Keep but Hidden)

**These tables preserve dormant infrastructure that may be useful later:**

1. **Old event/tracking tables** (if still exist):
   - `sessions` (old live session)
   - `events` (old chronology)
   - `snapshots` (old frame snapshots)
   - `training_memories`

2. **Processing infrastructure**:
   - `axis_behavioral_memory` (future intelligence foundation)
   - `axis_session_analysis` (dormant summaries)

**Action**: Do not delete, but remove from code references. Migrate relevant data to new schema, then deprecate old tables.

---

### Fix Security Policies

**These tables have risky policies:**

1. **`axis_sessions`**:
   - Current: `allow all` public insert/select/update
   - Fix: Require `auth.uid()` match or service-role-only

2. **`game_sessions`, `game_events`, `game_players`**:
   - Current: `allow all` public policies
   - Fix: Remove these tables or fix policies

**Action**: Fix policies *before* deleting tables.

---

## VERIFICATION CHECKLIST

### Phase 1: Evidence
- [ ] Upload 100MB video, verify stored in Mux
- [ ] Retrieve session metadata, verify all fields
- [ ] Play video in browser, verify playback smooth
- [ ] Test with different resolutions (360p, 720p, 1080p)

### Phase 2: Events
- [ ] Create 10 events with various timestamps
- [ ] Query events by time range, verify all returned
- [ ] Update event, verify changes persisted
- [ ] Delete event, verify removed
- [ ] Query performance <50ms for 100-event session

### Phase 3: Overlays
- [ ] Draw 5 overlays (box, line, text), verify stored
- [ ] Query overlays by time range, verify correct
- [ ] Update overlay geometry, verify changes
- [ ] Delete overlay, verify removed
- [ ] Query performance <50ms for 100-overlay session

### Phase 4: Timeline
- [ ] Query timeslice for time window, verify merged response
- [ ] Verify cache hits on repeated queries
- [ ] Test with concurrent requests, verify correctness
- [ ] Verify response includes session + events + overlays

### Phase 5: Reconstruction
- [ ] Play video, verify no sync drift over 10+ minutes
- [ ] Verify overlays appear at correct timestamps
- [ ] Scrub timeline, verify overlays update instantly
- [ ] Test with 50+ simultaneous overlays, measure frame rate

### Phase 6: Authoring
- [ ] Create event from UI, verify API called and stored
- [ ] Draw overlay from UI, verify geometry correct
- [ ] Verify undo/redo works for both
- [ ] Test with rapid-fire creation (10 events/sec)

### Phase 7: Teaching
- [ ] Create clip, verify saved and shareable
- [ ] View clip, verify correct time range and overlays
- [ ] Share clip URL, verify accessible
- [ ] Export clip to video (if implemented), verify file

### Phase 8: CV (if implemented)
- [ ] Submit session to CV, verify suggestions returned in <60s
- [ ] Accept suggestion, verify written to Event/Overlay table
- [ ] Verify rejected suggestions not saved
- [ ] Test accuracy on 5+ real videos

---

## ARCHITECTURE INVARIANTS

**Preserve**:
1. Single timeline per recording (immutable)
2. Single event table (no copies)
3. Single overlay table (no copies)
4. All queries time-anchored
5. Evidence → Events → Overlays → Render dependency order
6. CV as optional acceleration layer (not required)
7. Each layer independently testable

**Never**:
- Duplicate event data across tables
- Join events and overlays on anything other than timestamp
- Store computed overlays (draw them on demand)
- Require CV to use the system
- Hardcode time sync logic (make it parameterizable)
- Add tables without eliminating old equivalents

---

## SUCCESS CRITERIA

1. **Minimal**: No feature added that duplicates another layer's responsibility.
2. **Fast**: Timeslice queries <50ms. Playback sync drift <100ms over 30 min.
3. **Independent**: Each layer can be tested without others.
4. **Extensible**: Adding CV layer requires zero changes to existing tables.
5. **Operational**: Can upload, create events, playback with overlays, and share clips in <10 min per session.

---

## CONCLUSION

Axis Reconstruction is a four-layer foundation:

- **Evidence**: Raw video (immutable)
- **Events**: Semantic facts (manually created, CV-accelerated)
- **Overlays**: Visual annotations (manually drawn, CV-assisted)
- **Time**: Unified timeline (all layers synchronized)

Built on this foundation, Reconstruction and Teaching surfaces let users replay their captured moments with context, teach others, and understand their effort without requiring computer vision.

CV enters *later* as a convenience layer that reduces manual effort, not as the architectural foundation.

This design eliminates duplicates, keeps layers independent, and allows Axis to be both a continuity system *and* a reconstruction platform without competing for resources or creating conceptual confusion.
