# AXIS RECONSTRUCTION: ARCHITECTURE INDEX

**Principal Systems Redesign Package**  
**Date**: 2026-06-07  
**Status**: Ready for Review

---

## EXECUTIVE SUMMARY

**Axis is rebuilding as a reconstruction and overlay platform.**

Core primitives:
- **Evidence**: Raw video (immutable)
- **Events**: Semantic moments (manually created, CV-accelerated)
- **Overlays**: Visual annotations (manually drawn)
- **Time**: Unified timeline (all layers synchronized)

Four-layer architecture:
1. **Evidence Layer** (Week 1): Upload video, store metadata
2. **Event Layer** (Week 2): Create, persist, and query events
3. **Overlay Layer** (Week 3): Store and query geometric annotations
4. **Timeline Query Engine** (Week 4): Fast unified queries
5. **Reconstruction & Render** (Week 5): Playback with synchronized overlays
6. **Authoring Layer** (Week 6): Manual creation with keyboard shortcuts
7. **Teaching Surface** (Week 7): Create and share clips with narrative
8. **CV Integration** (Week 8+): Optional acceleration layer

**Timeline**: 8 weeks to full operational platform (including optional CV).

**Team**: 2-3 FTE core team + design + QA.

---

## DOCUMENT ROADMAP

### For Quick Understanding
1. **[AXIS_RECONSTRUCTION_EXECUTIVE_SUMMARY.md](AXIS_RECONSTRUCTION_EXECUTIVE_SUMMARY.md)** (15 min read)
   - High-level problem + solution
   - Architecture overview
   - Success criteria
   - What to delete

### For Detailed Design
2. **[AXIS_RECONSTRUCTION_ARCHITECTURE.md](AXIS_RECONSTRUCTION_ARCHITECTURE.md)** (60 min read)
   - Complete system architecture
   - Layer definitions
   - Data model (tables, schemas)
   - Risks and mitigations
   - Verification checklist

### For Sprint Planning
3. **[AXIS_BUILD_ORDER.md](AXIS_BUILD_ORDER.md)** (40 min read)
   - Week-by-week breakdown
   - Detailed tasks for each phase
   - Acceptance criteria
   - Parallel work streams
   - Team composition

### For Cleanup Execution
4. **[AXIS_CLEANUP_GUIDE.md](AXIS_CLEANUP_GUIDE.md)** (30 min read)
   - What to delete (with backup first)
   - What to keep and archive
   - Specific SQL/bash commands
   - Verification checklist
   - Rollback plan

---

## CORE CONCEPTS QUICK REFERENCE

### Three Core Primitives

| Primitive | Definition | Persistence | Ownership |
|-----------|-----------|-------------|-----------|
| **Evidence** | Raw video file + metadata | Mux (source of truth) | Session |
| **Events** | (timestamp, type, metadata) | Supabase `axis_events` | User-created |
| **Overlays** | (timestamp, geometry, styling) | Supabase `axis_overlays` | User-created |
| **Time** | Milliseconds from recording start | Immutable timeline | System |

### System Architecture (4 Layers)

```
Teaching Surface
├── Reconstruction & Overlay Render
├── Timeline Query Engine
└── Evidence + Event + Overlay Persistence
```

### Build Order

| Week | Phase | What | Team |
|------|-------|------|------|
| W1 | Evidence | Upload video, store metadata | Backend + Infra |
| W2 | Events | Create/query events manually | Backend |
| W3 | Overlays | Store/query geometric annotations | Backend |
| W4 | Timeline | Fast unified queries | Backend |
| W5 | Render | Video + synchronized overlays | Frontend + Backend |
| W6 | Authoring | Manual creation with UI | Frontend + Design |
| W7 | Teaching | Share clips with narrative | Frontend + Design |
| W8+ | CV (Optional) | Accelerate event/overlay creation | Backend + CV |

---

## KEY PRINCIPLES

**No Duplicates**
- One recording per session (Mux)
- One event table (not scattered)
- One overlay table (new, clean)
- One timeline (milliseconds from start)
- All queries join on timestamp only

**Independent Layers**
- Each layer has own table(s), API, tests
- Can develop in parallel
- Can test in isolation
- Zero dependencies on CV

**Preserved Continuity**
- This design does NOT impact active check-in → history → leaderboard loop
- Reconstruction is separate product layer underneath
- Both can coexist without conflict

---

## DATA MODEL

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

- **`axis_sessions`**: Add `duration_ms`, `frame_rate_hz`, `resolution_width`, `resolution_height`
- **`axis_events`**: Verify index `(session_id, timestamp_ms)`

### Tables to Delete (Abandoned Products)

**Game-state** (empty):
- `teams`, `players`, `game_sessions`, `game_players`, `game_events`, `lineup_segments`, `sub_events`, `review_marks`

**Old event tracking** (dormant):
- `sessions` (old live), `events` (old chronology), `snapshots`, `training_memories`

**Empty buckets**:
- `game-film`, `session-snapshots`, `training-frames`

---

## RISKS & MITIGATIONS

| Risk | Severity | Mitigation |
|------|----------|-----------|
| **Timestamp sync drift** | HIGH | Use video.currentTime as truth, throttle redraws, test extensively |
| **Duplicate event data** | HIGH | Code review, single-table enforcement, schema guards |
| **Many overlays performance** | MEDIUM | Batch rendering, level-of-detail, measure frame rate |
| **CV accuracy (future)** | MEDIUM | Manual review required, confidence scores, A/B testing |
| **Mux outage** | MEDIUM | Local preview, fallback storage, graceful degradation |
| **Schema migration** | HIGH | Export old data, transform, validate, keep old read-only 1 week |

---

## SUCCESS CRITERIA

1. ✅ **Minimal**: No feature duplicates another layer
2. ✅ **Fast**: Timeslice queries <50ms. Sync drift <100ms over 30 min
3. ✅ **Independent**: Each layer testable in isolation
4. ✅ **Extensible**: CV layer requires zero schema changes
5. ✅ **Operational**: Upload → Create events → Playback → Share in <10 min per session

---

## VERIFICATION CHECKLIST (PHASE BY PHASE)

### Phase 1: Evidence ✅
- [ ] Upload 100MB video, verify stored in Mux
- [ ] Retrieve session metadata, verify all fields
- [ ] Play video in browser, verify playback smooth
- [ ] Test with different resolutions

### Phase 2: Events ✅
- [ ] Create 10 events with various timestamps
- [ ] Query events by time range, verify all returned
- [ ] Update/delete events, verify changes persisted
- [ ] Query performance <50ms for 100-event session

### Phase 3: Overlays ✅
- [ ] Draw 5 overlays (box, line, text), verify stored
- [ ] Query overlays by time range, verify correct
- [ ] Update/delete overlays, verify changes
- [ ] Query performance <50ms for 100-overlay session

### Phase 4: Timeline ✅
- [ ] Query timeslice, verify merged response correct
- [ ] Verify cache hits on repeated queries
- [ ] Test with concurrent requests
- [ ] Verify no duplicate data in response

### Phase 5: Reconstruction ✅
- [ ] Play video, verify no sync drift over 10+ minutes
- [ ] Overlays appear at correct timestamps
- [ ] Scrub timeline, overlays update instantly
- [ ] 50+ overlays render at 24+ fps

### Phase 6: Authoring ✅
- [ ] Create event from UI via keyboard shortcut
- [ ] Draw overlay with canvas tools
- [ ] Undo/redo working
- [ ] Keyboard shortcuts responsive

### Phase 7: Teaching ✅
- [ ] Create clip by selecting time range
- [ ] Clip playback works correctly
- [ ] Clip can be shared via URL
- [ ] Can list, edit, delete clips

### Phase 8: CV (Optional) ✅
- [ ] Submit session to CV, suggestions returned in <60s
- [ ] Accept/reject suggestions working
- [ ] Suggestions written to Event/Overlay tables correctly
- [ ] System works without CV

---

## TIMELINE & SCHEDULE

### Week 1: Evidence Foundation
- Backend + Infra: Build upload API, verify Mux integration, deploy session metadata API

### Week 2: Event Layer
- Backend: Build event CRUD API, create event type schema, deploy event creation UI

### Week 3: Overlay Layer
- Backend: Create `axis_overlays` table, build overlay CRUD API, deploy drawing UI

### Week 4: Timeline Query Engine
- Backend: Implement timeslice query, add caching, verify performance

### Week 5: Reconstruction & Render
- Frontend + Backend: Build replay player, implement time-sync, render overlays

### Week 6: Authoring Layer
- Frontend + Design: Build event/overlay creation UI, add keyboard shortcuts, implement undo/redo

### Week 7: Teaching Surface
- Frontend + Design: Build clip creation, playback, sharing UI

### Week 8+: CV Integration (Optional)
- Backend + CV: Integrate Roboflow + ByteTrack, build review UI

---

## PARALLEL WORK STREAMS (After W1)

| Stream | Phases | Notes |
|--------|--------|-------|
| Backend Foundation | 2, 3, 4 | Core persistence and query layer |
| Frontend Rendering | 5, 7 | Replay player and teaching surfaces |
| Authoring UX | 6 | Event/overlay creation with keyboard shortcuts |
| CV Integration | 8 | Optional acceleration layer (no schema changes) |

---

## WHAT'S NOT CHANGING

**The continuity loop is preserved completely**:
- ✅ Check-in/Check-out unchanged
- ✅ Effort hours unchanged
- ✅ Streaks unchanged
- ✅ Leaderboard unchanged
- ✅ Organization memberships unchanged
- ✅ Clerk auth unchanged

Reconstruction is a **separate product layer** that lives underneath and never interferes with the active participation loop.

---

## QUICK ANSWERS

**Q: Why is CV optional?**  
A: Axis works fully without CV. Events and overlays are created manually or with CV assistance. CV is an acceleration layer (phase 8+), not the foundation. You can use the system day one without it.

**Q: Why rebuild from first principles?**  
A: Current architecture has duplicate event tables, scattered timeline concepts, and conflates reconstruction with continuity. This design separates them cleanly into four independent layers with no duplicates.

**Q: How long to MVP?**  
A: 7 weeks to teaching surface. 8+ weeks if adding optional CV.

**Q: What's the biggest risk?**  
A: Timestamp sync drift (video/overlay mismatch visible to user). Mitigated by using video.currentTime as truth and testing extensively.

**Q: Can I use this without uploading video?**  
A: Currently, no. This design assumes video is uploaded to Mux. Future: could add live streaming support, but not in MVP.

**Q: What happens to old tables?**  
A: Game-state tables (teams, players, etc.) are deleted. Old event/session tables are archived. Mux, Supabase, and continuity tables are kept.

---

## NEXT STEPS

1. ✅ **Review**: Leadership signs off on architecture
2. ✅ **Kickoff**: Phase 1 detailed planning (1-2 days)
3. ✅ **Assign**: Team leads for each phase
4. ✅ **Create**: Jira tickets from build order
5. ✅ **Setup**: CI/CD automated testing
6. ✅ **Begin**: Phase 1 (Week 1)

---

## DOCUMENT LOCATIONS

All documents in: `/context/`

```
context/
├── AXIS_RECONSTRUCTION_EXECUTIVE_SUMMARY.md  ← Start here
├── AXIS_RECONSTRUCTION_ARCHITECTURE.md       ← Full design
├── AXIS_BUILD_ORDER.md                       ← Sprint planning
├── AXIS_CLEANUP_GUIDE.md                     ← Deletion instructions
└── AXIS_RECONSTRUCTION_INDEX.md              ← This file
```

---

## AUTHOR & FEEDBACK

**Designed by**: Principal Systems Architect  
**Date**: 2026-06-07  
**Status**: Ready for review and implementation

**For feedback or clarifications**:
- Architecture questions → Review AXIS_RECONSTRUCTION_ARCHITECTURE.md
- Sprint planning questions → Review AXIS_BUILD_ORDER.md
- Deletion questions → Review AXIS_CLEANUP_GUIDE.md
- Executive questions → Review AXIS_RECONSTRUCTION_EXECUTIVE_SUMMARY.md

---

## APPENDIX: DESIGN RATIONALE

### Why Four Layers?

**Evidence Layer** = Input (video is immutable)  
**Event Layer** = Semantic facts (user creates them)  
**Overlay Layer** = Visual annotations (user draws them)  
**Timeline Query Engine** = Synchronization mechanism (all layers joined on time)

This is the minimal set needed to support:
1. Upload video ✓
2. Create events ✓
3. Replay events ✓
4. Draw overlays ✓
5. Add CV later ✓

### Why Not Duplicates?

**One recording per session** (not in multiple places)
- Reason: Video is expensive to store. Single source of truth (Mux) saves cost and prevents inconsistency.

**One event table** (not scattered)
- Reason: Event queries must be fast and consistent. Multiple tables = complex joins, slow queries, risk of data divergence.

**One overlay table** (not computed)
- Reason: Overlays are persistent user annotations. Must be stored once, rendered on demand. No precomputed cached versions.

**One timeline** (not split by concept)
- Reason: All layers must synchronize to the same clock (video.currentTime). Single timestamp primitive = no sync issues.

### Why Independent Layers?

Each layer is independently testable because:
- Layer has its own table (or tables)
- Layer has its own CRUD API
- Layer has its own business logic
- Layer has its own tests
- Layers don't call each other internally (only via query engine)

Example: Can test Event layer without Overlay layer. Can test Overlay layer without CV layer.

### Why CV is Optional?

CV is phase 8 because:
- System works fully without it (7 weeks of functionality)
- Adding CV later requires zero schema changes
- Users can manually create events/overlays (slow but complete)
- CV is an acceleration layer (faster event/overlay creation), not a foundation
- If CV fails, system still works

---

## CONCLUSION

**Axis Reconstruction is a clean, minimal architecture for:**
- Uploading video
- Creating semantic events
- Drawing visual overlays
- Replaying them synchronized
- Sharing clips with narrative
- Adding CV later (optional)

**Built on:**
- Three immutable primitives (Evidence, Events, Time)
- Four independent layers (each testable in isolation)
- Zero duplicate concepts (single source of truth)
- Zero impact on the continuity loop

**Timeline**: 8 weeks, 2-3 FTE core team.

**Ready to build.** 🚀
