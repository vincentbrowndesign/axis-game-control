# AXIS RECONSTRUCTION: BUILD ORDER & DEPENDENCIES

**Planning Document**  
**Date**: 2026-06-07

---

## PHASE SUMMARY TABLE

| Phase | Week | Layer | Status | Priority | Blockers | Team |
|-------|------|-------|--------|----------|----------|------|
| 1 | W1 | **Evidence** | Foundation | CRITICAL | None | Backend + Infra |
| 2 | W2 | **Events** | Foundation | CRITICAL | Phase 1 | Backend |
| 3 | W3 | **Overlays** | Foundation | CRITICAL | Phase 1 | Backend |
| 4 | W4 | **Timeline Query** | Foundation | CRITICAL | Phases 2, 3 | Backend |
| 5 | W5 | **Reconstruction Render** | Feature | HIGH | Phase 4 | Frontend + Backend |
| 6 | W6 | **Authoring Layer** | Feature | HIGH | Phases 2, 3, 5 | Frontend + Design |
| 7 | W7 | **Teaching Surface** | Feature | MEDIUM | Phases 4, 6 | Frontend + Design |
| 8+ | W8+ | **CV Integration** | Optional | LOW | All above | Backend + CV |

---

## PHASE 1: EVIDENCE FOUNDATION

**Goals**: Upload video, store metadata, enable playback.

**Timeline**: 1 week  
**Team**: Backend + Infrastructure  
**Blockers**: None

### Tasks

#### 1.1 Audit `axis_sessions` Schema
- [ ] Read current schema from Supabase
- [ ] Verify fields: `mux_asset_id`, `mux_playback_id`, `recording_url`
- [ ] Check missing fields: `duration_ms`, `frame_rate_hz`, `resolution_width`, `resolution_height`
- [ ] Verify RLS policy (should require `user_id` match or service-role)
- [ ] Create migration to add missing fields if needed

**Acceptance**: Schema audit document + migration SQL

#### 1.2 Verify Mux Integration
- [ ] Test upload: 100MB video → Mux
- [ ] Verify response: `asset_id`, `playback_id` returned
- [ ] Verify stored in `axis_sessions`
- [ ] Test playback: URL → browser video player
- [ ] Test multiple resolutions (360p, 720p, 1080p)

**Acceptance**: Working upload + playback in dev environment

#### 1.3 Build Upload API
- [ ] Endpoint: `POST /api/sessions`
- [ ] Auth: Require Clerk user
- [ ] Input: Video file (multipart/form-data) + session metadata (optional)
- [ ] Processing:
  1. Create session record in DB
  2. Upload to Mux
  3. Wait for Mux response
  4. Store `mux_playback_id` in session
  5. Return session object with playback URL
- [ ] Error handling: File size limits, upload timeout, invalid format
- [ ] Test: Upload various file sizes

**Acceptance**: API working, all error cases handled

#### 1.4 Build Session Metadata API
- [ ] Endpoint: `GET /api/sessions/{id}`
- [ ] Returns: Session object with video metadata + Mux playback URL
- [ ] Endpoint: `GET /api/sessions`
- [ ] Returns: List of user's sessions with pagination
- [ ] Test: Retrieve metadata, verify correctness

**Acceptance**: APIs working, metadata queries fast

#### 1.5 Playback Integration Test
- [ ] Build simple playback page: `/sessions/{id}/watch`
- [ ] Display video player (Mux URL)
- [ ] Display session metadata (duration, resolution)
- [ ] Test playback: play, pause, seek, duration accuracy

**Acceptance**: Video plays in browser smoothly

### Deliverables

- ✅ Schema audit + migration SQL
- ✅ Upload API fully functional
- ✅ Session metadata API fully functional
- ✅ Playback page working
- ✅ Performance baseline: <5s upload for 100MB, <2s metadata query

### Risks

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Mux API rate limits | MEDIUM | Implement request throttling, queue uploads |
| Large file uploads timeout | MEDIUM | Implement resumable uploads, set timeouts to 10min+ |
| Mux outage during testing | LOW | Use staging Mux account, implement retry logic |
| S3 bucket size limits | LOW | Monitor usage, implement cleanup for old videos |

### Success Criteria

- [ ] Upload 100MB video successfully
- [ ] Playback URL returned correctly
- [ ] Video plays in browser without buffering
- [ ] Can retrieve session metadata quickly

---

## PHASE 2: EVENT LAYER

**Goals**: Create, persist, and query events manually.

**Timeline**: 1 week  
**Team**: Backend  
**Blockers**: Phase 1 (need working sessions)

### Tasks

#### 2.1 Verify `axis_events` Schema
- [ ] Read current schema from Supabase
- [ ] Verify fields: `id`, `session_id`, `timestamp_ms`, `event_type`, `metadata`
- [ ] Verify indexes: `(session_id, timestamp_ms)`
- [ ] Check RLS policy
- [ ] Verify Mux playback URL accessible before inserting events

**Acceptance**: Schema audit document

#### 2.2 Define Event Type Schema
- [ ] Enum: `shot_attempt`, `made_shot`, `missed_shot`, `player_entry`, `player_exit`, `turnover`, `timeout`, `foul`, `substitution`
- [ ] For each type, define required metadata fields (e.g., `shot_attempt` requires `player_id`, optional `location`)
- [ ] Create TypeScript enum file: `lib/axis-events/event-types.ts`
- [ ] Create validation schema (zod or similar)

**Acceptance**: Enum + validation schema implemented

#### 2.3 Build Event CRUD API

##### Create Event
- [ ] Endpoint: `POST /api/sessions/{id}/events`
- [ ] Input: `{ timestamp_ms, event_type, metadata }`
- [ ] Validation:
  - Timestamp must be within recording duration
  - Event type must be valid enum
  - Metadata must match event type schema
- [ ] Returns: Created event object
- [ ] Error handling: Invalid timestamp, invalid type, validation failures

**Acceptance**: Create event API working with validation

##### List Events
- [ ] Endpoint: `GET /api/sessions/{id}/events?start_ms=X&end_ms=Y`
- [ ] Returns: Events in time range, sorted by timestamp
- [ ] Pagination: Limit 100 per request
- [ ] Test performance: Should be <50ms for 1000-event session

**Acceptance**: List API fast and correct

##### Update Event
- [ ] Endpoint: `PATCH /api/sessions/{id}/events/{event_id}`
- [ ] Input: `{ timestamp_ms?, event_type?, metadata? }`
- [ ] Same validation as create
- [ ] Returns: Updated event object

**Acceptance**: Update API working

##### Delete Event
- [ ] Endpoint: `DELETE /api/sessions/{id}/events/{event_id}`
- [ ] Returns: 204 No Content
- [ ] Verify deletion (query confirms removal)

**Acceptance**: Delete API working

#### 2.4 Index Performance Tuning
- [ ] Create composite index: `(session_id, timestamp_ms)`
- [ ] Test query: 100 events, 1 million total events in table
- [ ] Measure: <50ms for range query
- [ ] If slow, analyze query plan and optimize

**Acceptance**: Query performance <50ms confirmed

#### 2.5 Simple Event Creation UI
- [ ] Route: `/sessions/{id}/events`
- [ ] Form to create event:
  - Dropdown: event type
  - Input: timestamp (numeric or time picker)
  - JSON editor: metadata (optional)
  - Button: Create
- [ ] Display: List of created events with timestamps
- [ ] Test: Create 10 events, verify all listed

**Acceptance**: UI functional, can create events quickly

### Deliverables

- ✅ Event type schema (enum + validation)
- ✅ Event CRUD API (all 4 operations)
- ✅ Index performance verified (<50ms)
- ✅ Event creation UI
- ✅ Test: Create and list 100 events in <100ms

### Risks

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Index on large table degrades | MEDIUM | Monitor query plans, consider partitioning |
| Timestamp precision issues | LOW | Use milliseconds consistently, add validation |
| Metadata validation too strict | MEDIUM | Make optional fields truly optional, test with real event types |

### Success Criteria

- [ ] Can create event with valid timestamp and type
- [ ] Can query events by time range
- [ ] Query performance <50ms for typical sessions
- [ ] UI allows rapid event creation (can create 10 events in <1 min)

---

## PHASE 3: OVERLAY LAYER

**Goals**: Store and query geometric annotations.

**Timeline**: 1 week  
**Team**: Backend  
**Blockers**: Phase 1 (need working sessions)

### Tasks

#### 3.1 Create `axis_overlays` Table
- [ ] Schema:
  ```sql
  CREATE TABLE axis_overlays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL,
    timestamp_ms BIGINT NOT NULL,
    overlay_type TEXT NOT NULL,
    geometry JSONB NOT NULL,
    styling JSONB,
    created_by UUID,
    created_at TIMESTAMP DEFAULT now(),
    FOREIGN KEY (session_id) REFERENCES axis_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES axis_profiles(id)
  );
  ```
- [ ] Create index: `(session_id, timestamp_ms)`
- [ ] Enable RLS: `auth.uid() = created_by` OR service-role

**Acceptance**: Table created, index verified

#### 3.2 Define Overlay Type Schema
- [ ] Types: `tracking_box`, `trajectory`, `text_label`, `court_line`, `target_region`, `metric_display`
- [ ] For each type, define geometry format:
  - `tracking_box`: `{ x, y, width, height }` (normalized to 0-1)
  - `trajectory`: `[{ x, y }, { x, y }, ...]` (path points)
  - `text_label`: `{ x, y, text, font_size }` (normalized coords)
  - `court_line`: `{ points: [...], is_dashed: bool }` (court reference)
  - `target_region`: `{ points: [...], label: string }` (polygonal region)
  - `metric_display`: `{ x, y, label, value, unit }` (numeric metric)
- [ ] Styling: `{ color, opacity, stroke_width, font_family }` (JSON)
- [ ] Create TypeScript types

**Acceptance**: Schema defined + TypeScript types implemented

#### 3.3 Build Overlay CRUD API

##### Create Overlay
- [ ] Endpoint: `POST /api/sessions/{id}/overlays`
- [ ] Input: `{ timestamp_ms, overlay_type, geometry, styling? }`
- [ ] Validation:
  - Timestamp within recording duration
  - Overlay type valid
  - Geometry matches type schema
  - Coordinates normalized (0-1)
- [ ] Returns: Created overlay object
- [ ] Error handling: Invalid type, invalid geometry, validation failures

**Acceptance**: Create overlay API working

##### List Overlays
- [ ] Endpoint: `GET /api/sessions/{id}/overlays?start_ms=X&end_ms=Y`
- [ ] Returns: Overlays in time range, sorted by timestamp
- [ ] Pagination: Limit 200 per request
- [ ] Performance: <50ms for 1000-overlay session

**Acceptance**: List API fast and correct

##### Update Overlay
- [ ] Endpoint: `PATCH /api/sessions/{id}/overlays/{overlay_id}`
- [ ] Input: `{ timestamp_ms?, geometry?, styling? }`
- [ ] Same validation as create
- [ ] Returns: Updated overlay

**Acceptance**: Update API working

##### Delete Overlay
- [ ] Endpoint: `DELETE /api/sessions/{id}/overlays/{overlay_id}`
- [ ] Returns: 204
- [ ] Verify deletion

**Acceptance**: Delete API working

#### 3.4 Simple Overlay Drawing UI
- [ ] Route: `/sessions/{id}/overlays`
- [ ] Canvas element with video background (read-only)
- [ ] Toolbar: Rectangle, Line, Text, Color picker, Opacity slider
- [ ] Drawing tools:
  - Rectangle: click + drag to create box
  - Line: click points to create path, double-click to finish
  - Text: click to place, type text
- [ ] For each drawn overlay: timestamp picker, save to API
- [ ] Display: List of created overlays with thumbnails
- [ ] Test: Draw 5 overlays, verify saved

**Acceptance**: Drawing UI functional, overlays persist

### Deliverables

- ✅ `axis_overlays` table + index
- ✅ Overlay type schema (types + geometry format)
- ✅ Overlay CRUD API (all 4 operations)
- ✅ Drawing UI (rectangle, line, text tools)
- ✅ Test: Create and query 100 overlays in <100ms

### Risks

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Canvas coordinate mapping errors | MEDIUM | Test with known overlays, verify visual positioning |
| Large geometry JSON blobs | LOW | Compress geometry, consider limits on complexity |
| Drawing tool UX confusing | MEDIUM | Implement undo/redo, keyboard shortcuts, visual feedback |

### Success Criteria

- [ ] Can draw rectangle overlay, verify geometry stored
- [ ] Can draw line/trajectory, verify points stored
- [ ] Can draw text label, verify text stored
- [ ] Can query overlays by time range
- [ ] Query performance <50ms
- [ ] Drawing tools intuitive (can draw 5 overlays in <2 min)

---

## PHASE 4: TIMELINE QUERY ENGINE

**Goals**: Fast unified queries across all layers.

**Timeline**: 1 week  
**Team**: Backend  
**Blockers**: Phases 2, 3 (need working events and overlays)

### Tasks

#### 4.1 Implement Timeslice Query
- [ ] Function: `GetTimeslice(session_id, timestamp_ms, window_ms)`
- [ ] Parallel queries:
  1. Session lookup (return metadata + Mux playback URL)
  2. Event range query: `timestamp_ms - window_ms/2` to `timestamp_ms + window_ms/2`
  3. Overlay range query: same time range
- [ ] Merge results by timestamp (JSON response)
- [ ] Returns:
  ```json
  {
    "session": { id, duration_ms, mux_playback_id, ... },
    "timestamp_ms": 5000,
    "window_ms": 1000,
    "events": [
      { id, timestamp_ms, event_type, metadata },
      ...
    ],
    "overlays": [
      { id, timestamp_ms, overlay_type, geometry, styling },
      ...
    ],
    "frame_info": {
      "timestamp_ms": 5000,
      "frame_index": 120  // at 24fps
    }
  }
  ```
- [ ] Error handling: Session not found, invalid timestamp range

**Acceptance**: Query function implemented and tested

#### 4.2 Build Timeslice API
- [ ] Endpoint: `GET /api/sessions/{id}/timeslice?timestamp_ms=X&window_ms=Y`
- [ ] Input validation: timestamp_ms within recording, window_ms > 0
- [ ] Returns: Timeslice response (above)
- [ ] Test: Query for various timestamps and windows

**Acceptance**: API working, response format correct

#### 4.3 Add Caching Layer
- [ ] Cache strategy: (session_id, timestamp_ms, window_ms) → timeslice response
- [ ] TTL: 1 hour (or invalidate on event/overlay write)
- [ ] Implement with in-memory cache (Node.js) or Redis
- [ ] Test: Repeated query should hit cache
- [ ] Measure: Cache hit rate, latency improvement

**Acceptance**: Cache implemented and verified working

#### 4.4 Performance Tuning
- [ ] Baseline: Timeslice query on 1000-event, 1000-overlay session
- [ ] Measure: <50ms without cache, <10ms with cache
- [ ] If slow:
  - Check index usage in query plans
  - Consider adding more granular indexes
  - Test with realistic data volumes
- [ ] Load test: 10 concurrent timeslice queries
- [ ] Verify no duplicate data in response (data integrity)

**Acceptance**: Performance <50ms (uncached), <10ms (cached)

#### 4.5 Timeslice Query Integration Test
- [ ] Create test session with video
- [ ] Create 5 events at known timestamps
- [ ] Create 5 overlays at same timestamps
- [ ] Query timeslice, verify:
  - All events returned
  - All overlays returned
  - No duplicates
  - Correct ordering by timestamp

**Acceptance**: Timeslice queries return correct merged data

### Deliverables

- ✅ Timeslice query function (parallel + merge)
- ✅ Timeslice API endpoint
- ✅ Caching layer (in-memory or Redis)
- ✅ Performance verified (<50ms uncached, <10ms cached)
- ✅ Load test (10 concurrent queries working)

### Risks

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Cache invalidation errors | MEDIUM | Test cache invalidation on event/overlay writes, verify consistency |
| Concurrent query conflicts | LOW | Use atomic operations, test with stress load |
| Response bloat for large time windows | MEDIUM | Limit window size, paginate results if needed |

### Success Criteria

- [ ] Timeslice query returns events, overlays, and session metadata together
- [ ] Query performance <50ms for typical cases
- [ ] Cache working (hit rate > 80%)
- [ ] No data duplication in response

---

## PHASE 5: RECONSTRUCTION & OVERLAY RENDER

**Goals**: Playback video with synchronized overlays.

**Timeline**: 1 week  
**Team**: Frontend + Backend  
**Blockers**: Phase 4 (need timeslice queries)

### Tasks

#### 5.1 Build Replay Player Component
- [ ] Component: `<ReplayPlayer session_id={string} />`
- [ ] Structure:
  ```
  <div className="replay-container">
    <video src={mux_playback_url} />  {/* Mux player */}
    <canvas className="overlay-canvas" />  {/* Draw overlays here */}
    <div className="controls">
      <button>Play/Pause</button>
      <input type="range" />  {/* Timeline scrubber */}
      <span>{currentTime} / {duration}</span>
      <select defaultValue="1">  {/* Speed control */}
        <option>0.5x</option>
        <option selected>1x</option>
        <option>1.5x</option>
        <option>2x</option>
      </select>
    </div>
  </div>
  ```
- [ ] Implementation:
  1. Fetch session metadata (duration, mux_playback_id)
  2. Load Mux video
  3. On video play, start fetching timeslices
  4. On video currentTime update, fetch timeslice for that time
  5. Render overlays on canvas synchronized to video.currentTime

**Acceptance**: Player component renders and loads video

#### 5.2 Implement Time-Sync Logic
- [ ] Sync mechanism:
  1. Listen to video.currentTime updates (via timeupdate event)
  2. Throttle to video frame rate (requestAnimationFrame)
  3. Fetch timeslice for current time (from cache if available)
  4. Render overlays on canvas
- [ ] Sync verification:
  - Measure drift (difference between video.currentTime and overlay timestamp)
  - Alert if drift > 100ms
  - Log drift metrics
- [ ] Test: Play for 10+ minutes, measure drift
- [ ] Handle video stalls, playback speed changes

**Acceptance**: Overlays stay in sync with video (drift <100ms)

#### 5.3 Implement Overlay Rendering
- [ ] Canvas render function: `renderOverlay(context, overlay, frame_info)`
- [ ] For each overlay type:
  - `tracking_box`: Draw rectangle with color and opacity
  - `trajectory`: Draw polyline (connected path)
  - `text_label`: Draw text with font and color
  - `court_line`: Draw line or dashed line
  - `target_region`: Draw filled polygon with label
  - `metric_display`: Draw text with value and unit
- [ ] Canvas coordinate conversion: Normalized (0-1) → pixel coordinates
- [ ] Styling: Apply color, opacity, stroke width from overlay.styling

**Acceptance**: Overlay rendering working for all types

#### 5.4 Implement Scrubbing/Seeking
- [ ] Timeline scrubber (range input):
  - Set max to duration_ms
  - On change: video.currentTime = scrubber_value / 1000
  - Update scrubber position as video plays
  - Test: Seek to various points, verify video + overlays update

**Acceptance**: Scrubber seeking working

#### 5.5 Performance & Stress Testing
- [ ] Test with 50+ overlays per frame
- [ ] Measure frame rate (should be 24+ fps)
- [ ] Test with long videos (30+ min)
- [ ] Test memory usage (canvas buffers, timeslice cache)
- [ ] Profile: Identify bottlenecks (rendering? network?)

**Acceptance**: Performance acceptable (24+ fps with 50+ overlays)

### Deliverables

- ✅ Replay player component fully functional
- ✅ Time-sync logic (drift <100ms)
- ✅ Overlay rendering (all types)
- ✅ Scrubber seeking working
- ✅ Performance tested (24+ fps)
- ✅ Stress test results documented

### Risks

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Video/overlay sync drift over long playback | HIGH | Use video.currentTime as truth, test extensively over 30+ min |
| Canvas rendering bottleneck | MEDIUM | Profile rendering, implement batching, reduce overlay complexity |
| Mobile responsiveness issues | MEDIUM | Test on phone, adjust canvas sizing, handle orientation changes |
| Mux player API changes | LOW | Implement abstraction, test Mux version upgrades |

### Success Criteria

- [ ] Video plays smoothly from Mux URL
- [ ] Overlays appear at correct times
- [ ] Sync drift <100ms over 30+ minute recording
- [ ] Can scrub timeline and seek instantly
- [ ] 50+ overlays render at 24+ fps
- [ ] Works on desktop and mobile

---

## PHASE 6: AUTHORING LAYER

**Goals**: Create events and overlays manually with keyboard shortcuts.

**Timeline**: 1 week  
**Team**: Frontend + Design  
**Blockers**: Phases 2, 3, 5 (need working events, overlays, and replay)

### Tasks

#### 6.1 Build Event Creation Modal
- [ ] Trigger: Keyboard shortcut (e.g., `E`) while video is playing
- [ ] Modal form:
  - Timestamp: Auto-populated from video.currentTime, editable
  - Event type: Dropdown (shot_attempt, made_shot, missed_shot, etc.)
  - Metadata: Dynamic form fields based on event type
    - `shot_attempt`: player_id (required), location (optional JSON)
    - `made_shot`: player_id, location
    - `player_entry`: player_id, position
    - etc.
  - Buttons: Create, Cancel
- [ ] Keyboard shortcut: Submit on Enter, Cancel on Escape
- [ ] On create: Dismiss modal, list shows new event immediately
- [ ] Undo: Ctrl+Z to delete last event (requires confirmation or auto-undo)

**Acceptance**: Event modal working, events created instantly

#### 6.2 Build Overlay Drawing Tools
- [ ] Toolbar (floating or fixed):
  - Rectangle tool (keyboard: `R`)
  - Line/path tool (keyboard: `L`)
  - Text tool (keyboard: `T`)
  - Eraser (keyboard: `Del`)
  - Color picker (default: white)
  - Opacity slider
  - Undo (Ctrl+Z)
  - Redo (Ctrl+Y)
- [ ] Drawing modes:
  - **Rectangle**: Click + drag to draw, ESC to cancel
  - **Line**: Click to add point, double-click to finish, ESC to cancel
  - **Text**: Click to place, type text, click elsewhere to finish
  - **Eraser**: Click on overlay to remove it
- [ ] Drawn overlays: Timestamp auto-populated from video.currentTime, editable
- [ ] On save: Write to API, remove from canvas, list shows in history

**Acceptance**: Drawing tools intuitive and fast

#### 6.3 Implement Undo/Redo
- [ ] Undo stack: Track last 20 actions (create event, create overlay, delete, etc.)
- [ ] Ctrl+Z: Pop from undo stack, push to redo stack
- [ ] Ctrl+Y: Pop from redo stack, push to undo stack
- [ ] UI feedback: Show undo/redo buttons, disable when stack empty
- [ ] Test: Create event, draw overlay, undo both, redo both

**Acceptance**: Undo/redo working correctly

#### 6.4 Keyboard Shortcuts
- [ ] Define shortcuts:
  - `E`: Event creation modal
  - `R`: Rectangle tool
  - `L`: Line tool
  - `T`: Text tool
  - `Del`: Eraser
  - `Ctrl+Z`: Undo
  - `Ctrl+Y`: Redo
  - `Space`: Play/pause
  - `←/→`: Seek backward/forward (±1s)
  - `1/2/..`: Speed control (0.5x, 1x, 1.5x, 2x)
- [ ] Display: Show shortcut hints in UI
- [ ] Test: All shortcuts working

**Acceptance**: Keyboard shortcuts responsive and intuitive

#### 6.5 Metadata Validation
- [ ] Event metadata: Required fields enforced
  - `shot_attempt`: player_id required
  - Other types: Validate based on schema
- [ ] Overlay geometry: Coordinates validated (0-1 range)
- [ ] Error feedback: Clear messages for validation failures
- [ ] Test: Try to create event without required field, verify error

**Acceptance**: Validation working, errors clear

#### 6.6 Creation Speed Test
- [ ] Measure: Time to create 10 events
- [ ] Target: <1 minute
- [ ] Measure: Time to draw 10 overlays
- [ ] Target: <2 minutes
- [ ] Feedback: Speed feels natural, no UI lag

**Acceptance**: Creation workflow fast and responsive

### Deliverables

- ✅ Event creation modal (keyboard + form)
- ✅ Overlay drawing tools (rectangle, line, text, eraser)
- ✅ Undo/redo working (20-level stack)
- ✅ Keyboard shortcuts defined and tested
- ✅ Metadata validation enforced
- ✅ Creation speed verified (<1 min for 10 events, <2 min for 10 overlays)

### Risks

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Drawing tools hard to learn | MEDIUM | Add tutorial, tooltips, visual feedback, test with users |
| Keyboard shortcuts conflict with OS | LOW | Make shortcuts customizable, use common patterns (Ctrl+Z, etc.) |
| Undo/redo memory usage | LOW | Limit stack to 20 items, clear old items |
| Rapid event creation hits rate limits | MEDIUM | Batch API calls, implement local queue |

### Success Criteria

- [ ] Can create event with one keyboard shortcut
- [ ] Can draw rectangle, line, text overlays quickly
- [ ] Undo/redo working for all operations
- [ ] Keyboard shortcuts natural and discoverable
- [ ] Can author 10 events + overlays in <3 minutes
- [ ] Creation feels responsive (no delays)

---

## PHASE 7: TEACHING SURFACE

**Goals**: Create shareable clips with narrative.

**Timeline**: 1 week  
**Team**: Frontend + Design  
**Blockers**: Phases 4, 6 (need timeslice queries and authoring)

### Tasks

#### 7.1 Create `axis_clips` Table
- [ ] Schema (already defined in architecture doc)
- [ ] Fields: `id`, `session_id`, `start_timestamp_ms`, `end_timestamp_ms`, `title`, `description`, `overlay_selection`, `event_selection`, `share_url`, `is_public`, `created_by`, `created_at`, `updated_at`
- [ ] Index: `(share_url)` for fast lookup
- [ ] RLS: User can only create/update own clips

**Acceptance**: Table created and indexed

#### 7.2 Build Clip Creation UI
- [ ] Route: `/sessions/{id}/create-clip`
- [ ] Form:
  - **Time range**: Visual scrubber or input fields (start_ms, end_ms)
    - Show duration of selected range
    - Validate: start < end, within recording duration
  - **Title**: Text input (required)
  - **Description**: Text area (optional, narrative/teaching context)
  - **Event selection**: Checkboxes for events in the clip time range
    - Show event type and timestamp
    - User can include/exclude specific events
  - **Overlay selection**: Checkboxes for overlays in the clip time range
    - Show overlay type and timestamp
    - User can include/exclude specific overlays
  - **Privacy**: Radio button (private or public)
  - **Buttons**: Save clip, Preview, Cancel
- [ ] Preview: Show clip playback with selected events/overlays before saving

**Acceptance**: Clip creation form functional, preview working

#### 7.3 Build Clip Playback Surface
- [ ] Route: `/sessions/{id}/clips/{clip_id}`
- [ ] Display:
  - Video player (Mux URL)
  - Timeline (start_ms to end_ms only)
  - Overlays: Only selected overlays rendered
  - Events: Only selected events displayed
  - Narrative: Title and description shown prominently
  - Share button: Copy share URL to clipboard
- [ ] Share URL: `/clips/{share_url}` (publicly accessible if `is_public=true`)
- [ ] Public clip: Display without authentication

**Acceptance**: Clip playback working, share URL public

#### 7.4 Build Clip Management
- [ ] List view: `/sessions/{id}/clips`
  - Show all user's clips for this session
  - Display: title, start_ms, end_ms, duration, is_public status
  - Actions: View, Edit, Delete, Share (copy URL)
- [ ] Edit: Allow title, description, event/overlay selection updates
- [ ] Delete: Confirm deletion, remove clip

**Acceptance**: Clip management CRUD working

#### 7.5 Clip Export (Optional MVP-2)
- [ ] Endpoint: `POST /api/clips/{id}/export`
- [ ] Process:
  1. Render video from start_ms to end_ms
  2. Compose overlays onto video
  3. Add title/description card at start
  4. Encode as MP4 or WebM
  5. Return download URL
- [ ] Note: This can be deferred to MVP-2 if time is tight

**Acceptance**: Clip export working (or deferred)

#### 7.6 Teaching Narrative Patterns
- [ ] Document: Common teaching patterns for clips
  - "Three-point attempt sequence"
  - "Defense breakdown analysis"
  - "Player development montage"
  - "Key moment replay"
- [ ] Provide templates: Pre-formatted description examples
- [ ] Help users frame teaching context

**Acceptance**: Teaching patterns documented

### Deliverables

- ✅ `axis_clips` table created and indexed
- ✅ Clip creation UI (time range, title, description, event/overlay selection)
- ✅ Clip playback surface
- ✅ Clip management (list, edit, delete, share)
- ✅ Share URL public and working
- ✅ Teaching narrative patterns documented
- ✅ (Optional) Clip export to video

### Risks

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Clip export complexity | MEDIUM | Defer to MVP-2 if time tight, use Mux video composition API |
| Share URL security | LOW | Verify user ownership before returning clip, test public access |
| Clip storage growth | LOW | Monitor storage usage, implement cleanup policy for old clips |

### Success Criteria

- [ ] Can create clip by selecting time range and events/overlays
- [ ] Clip playback works correctly
- [ ] Clip can be shared via public URL
- [ ] Can list all clips for a session
- [ ] Can edit and delete clips
- [ ] (Optional) Can export clip to video file

---

## PHASE 8+: CV INTEGRATION (OPTIONAL)

**Goals**: Accelerate event/overlay creation with computer vision.

**Timeline**: 1+ weeks  
**Team**: Backend + CV  
**Blockers**: All previous phases

### Notes

- This phase is **OPTIONAL** and comes **after all other phases are complete**
- System works fully without CV
- CV is an acceleration layer only
- No schema changes required

### High-Level Plan

1. Define CV API contract (input: recording, output: suggested events + overlays)
2. Integrate Roboflow for detection + ByteTrack for tracking
3. Build review UI for suggestions
4. Auto-accept or manual approve?
5. Write accepted suggestions to Event/Overlay tables

**See architecture document for full details.**

---

## PARALLEL WORK STREAMS

After Phase 1 is complete, teams can work in parallel:

| Stream | Phases | Dependencies |
|--------|--------|--------------|
| Backend Foundation | 2, 3, 4 | Phase 1 |
| Frontend Rendering | 5, 7 | Phase 4 |
| Authoring UX | 6 | Phases 2, 3, 5 |
| CV Integration | 8 | Phases 1-7 |

---

## WEEKLY STANDUP TEMPLATE

### Each Friday
- [ ] Which phase(s) shipped?
- [ ] What's done, what's blocked?
- [ ] Performance metrics (query times, frame rate, etc.)
- [ ] Testing coverage (unit, integration, E2E)
- [ ] Technical debt or risks discovered?

---

## DEFINITION OF DONE

For each phase:
1. ✅ All tasks completed
2. ✅ Code reviewed and merged
3. ✅ Automated tests written (unit + integration)
4. ✅ Manual testing completed (checklist above)
5. ✅ Performance baseline documented
6. ✅ Risk assessment updated
7. ✅ Deliverables match acceptance criteria

---

## ROLLBACK PLAN

If a phase fails or introduces breaking changes:

1. ✅ Identify breaking change
2. ✅ Revert all code merged that week
3. ✅ Identify root cause (design flaw? implementation error?)
4. ✅ Redesign with team
5. ✅ Re-attempt following week

**Estimated impact**: 1 week delay per rollback.

---

## SUCCESS METRICS (END OF 8 WEEKS)

- ✅ Can upload video in <5 seconds
- ✅ Can create 10 events in <1 minute
- ✅ Can draw 10 overlays in <2 minutes
- ✅ Timeslice queries <50ms (uncached)
- ✅ Video playback + overlays sync drift <100ms
- ✅ Can create and share clips
- ✅ System works without CV
- ✅ Zero duplicate concepts in schema
- ✅ Each layer independently testable
- ✅ Full end-to-end: Upload → Create Events → Replay → Draw Overlays → Share in <10 min per session

---

## TEAM COMPOSITION RECOMMENDATION

| Role | Allocation | Phases |
|------|-----------|--------|
| Backend Lead | Full-time | 1, 2, 3, 4, 8 |
| Frontend Lead | Full-time | 5, 6, 7 |
| Product Manager | Part-time | Planning, sprint reviews |
| Design | Part-time | UX for 6, 7 |
| QA/Testing | Part-time | All phases |
| CV Engineer | Part-time (W8+) | Phase 8 |

**Total**: 2-3 FTE core team, flexible staffing for design and QA.

---

## NEXT STEPS

1. **Present to leadership**: Align on 8-week timeline
2. **Schedule kickoff**: Phase 1 detailed planning (1-2 days)
3. **Assign owners**: Team leads for each phase
4. **Create Jira tickets**: Break down tasks into subtasks
5. **Set up CI/CD**: Automated testing for each phase
6. **Begin Phase 1**: Week 1 (Evidence Foundation)
