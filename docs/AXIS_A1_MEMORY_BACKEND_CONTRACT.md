# Axis A1 Memory Backend Contract

Status: ACTIVE CONTRACT

Build decision: Define Contract

Runtime behavior: Unchanged

## 1. Purpose

This document defines the backend memory contract required for Axis A1.

It exists because the mobile A1 shell can create useful session memory locally, but the backend currently persists only session drafts.

This contract prevents the next migration or API pass from guessing. It defines what full Axis A1 memory must eventually persist, how the current mobile state should map into backend memory, and what runtime boundaries must stay protected.

Axis is a basketball session memory system.

First product win:

```text
Open phone
-> sign in
-> start session
-> type / talk / tap moment
-> end session
-> memory exists
```

## 2. Current Backend State

The current backend session foundation is:

- `GET /api/axis/sessions`
- `POST /api/axis/sessions`
- `public.axis_session_drafts`
- `src/lib/axis-session-drafts.ts`
- `src/lib/axis/types.ts`

Current behavior:

- `GET /api/axis/sessions` requires an authenticated owner.
- `GET /api/axis/sessions` returns recent owner-scoped session draft rows.
- `POST /api/axis/sessions` requires an authenticated owner.
- `POST /api/axis/sessions` validates a small create body.
- `POST /api/axis/sessions` inserts one row into `axis_session_drafts`.
- The active mobile shell can use this as a signed-in session index.

Current supported fields:

- `id`
- `owner_id`
- `title`
- `player_name`
- `player_id`
- `session_type`
- `status`
- `created_at`
- `updated_at`

Current TypeScript surface:

- `AxisSession.id`
- `AxisSession.title`
- `AxisSession.playerName`
- `AxisSession.playerId`
- `AxisSession.sessionType`
- `AxisSession.status`
- `AxisSession.createdAt`
- `AxisSession.persisted`
- `AxisSession.source`

Current limitations:

- No ended time.
- No duration.
- No full session focus field separate from title.
- No team field.
- No moments.
- No correction history.
- No evidence records.
- No summary.
- No next session card.
- No searchable session text.
- No detail route for one full saved memory.
- No update route for completing an existing draft.

The current backend is useful for session draft persistence, but it is not yet the full Axis Memory backend.

## 3. A1 Memory Requirement

When a session ends, the backend should persist enough data to rebuild:

- session identity
- user ownership
- session type
- session title / focus
- player / team context if available
- started time
- ended time
- duration
- status
- moments
- corrections
- evidence labels
- summary
- next session card
- searchable text

A1 memory must work without camera, mic, AI vision, ball tracking, or perfect network conditions. Typed and tapped input must still create memory.

## 4. Core Objects

### Axis Session

Represents one basketball session.

It owns the session-level identity, owner, timing, focus, status, summary, searchable text, and carryover into the next session.

### Axis Moment

Represents one meaningful thing that happened during a session.

It owns the product-facing structure:

```text
Situation -> Actor -> Action -> Outcome -> Cause -> Correction -> Evidence
```

### Axis Correction

Represents user feedback or correction to a moment.

It records how the user accepted, refined, rejected, or edited session memory.

### Axis Evidence

Represents proof or source connected to a moment.

In A1, evidence begins as manual notes and tap markers. Future evidence can include transcript, timestamp, video clip, image, or AI signal.

### Axis Next Session Card

Represents the carryover into the next session.

It should be simple enough to show on mobile and strong enough to make tomorrow's session easier.

## 5. Axis Session Contract

Conceptual fields:

| Field | Meaning |
| --- | --- |
| `id` | Stable session id. |
| `user_id` | Authenticated owner id. |
| `title` | User-facing session title. |
| `session_type` | Basketball session type. |
| `focus` | Current session objective or focus. |
| `player_name` | Optional player or group name. |
| `player_id` | Optional future player reference. |
| `team_name` | Optional team/program context. |
| `status` | Session lifecycle state. |
| `started_at` | When the session started. |
| `ended_at` | When the session ended. |
| `duration_seconds` | Computed or stored session length. |
| `summary` | Human-readable session summary. |
| `next_focus` | Short carryover for the next session. |
| `next_session_card` | Simple next-session object or reference. |
| `searchable_text` | Search text for Ask Axis and Memory. |
| `source` | How the session memory was created. |
| `created_at` | Row creation time. |
| `updated_at` | Last content update time. |

Status values:

- `draft`
- `active`
- `saved`
- `archived`

Source values:

- `typed`
- `tap`
- `voice`
- `video`
- `ai`
- `mixed`

A1 can use `typed`, `tap`, and `mixed` first.

## 6. Axis Moment Contract

Conceptual fields:

| Field | Meaning |
| --- | --- |
| `id` | Stable moment id. |
| `session_id` | Owning session id. |
| `user_id` | Authenticated owner id. |
| `timestamp_seconds` | Session elapsed time when captured. |
| `occurred_at` | Absolute time when captured. |
| `raw_input` | User's original typed/tapped/voice input. |
| `title` | Human-readable interpreted moment title. |
| `situation` | What kind of session situation this is. |
| `actor` | Player, group, team, or side involved. |
| `action` | What happened. |
| `outcome` | What resulted. |
| `cause` | Why it likely happened, when known. |
| `correction` | What should change or carry forward. |
| `evidence` | Product-facing evidence label. |
| `tags` | Secondary tags only. |
| `review_state` | User review state. |
| `source` | How the moment was created. |
| `created_at` | Row creation time. |
| `updated_at` | Last content update time. |

Review state values:

- `accepted`
- `needs_review`
- `corrected`
- `rejected`

Source values:

- `typed`
- `tap`
- `voice`
- `video`
- `ai`
- `mixed`

Core structure:

```text
Situation
-> Actor
-> Action
-> Outcome
-> Cause
-> Correction
-> Evidence
```

Do not make vague labels the core data model:

- `GOOD_READ`
- `BAD_READ`
- `GOOD_REP`
- `BAD_REP`
- `MAKE`
- `MISS`

Those can only be secondary tags later.

## 7. Axis Correction Contract

Conceptual fields:

| Field | Meaning |
| --- | --- |
| `id` | Stable correction id. |
| `moment_id` | Corrected moment id. |
| `session_id` | Owning session id. |
| `user_id` | Authenticated owner id. |
| `correction_type` | Correction action taken. |
| `previous_value` | Previous field/value when applicable. |
| `corrected_value` | New field/value when applicable. |
| `note` | Optional user note. |
| `created_at` | Correction creation time. |

Correction types:

- `correct`
- `refine`
- `not_right`
- `needs_review`
- `field_update`
- `tag_update`

## 8. Axis Evidence Contract

Conceptual fields:

| Field | Meaning |
| --- | --- |
| `id` | Stable evidence id. |
| `moment_id` | Connected moment id. |
| `session_id` | Owning session id. |
| `user_id` | Authenticated owner id. |
| `evidence_type` | Evidence/source type. |
| `label` | Human-readable label. |
| `value` | Short value or note. |
| `timestamp_seconds` | Session elapsed time, if relevant. |
| `url` | Future source URL, if relevant. |
| `created_at` | Evidence creation time. |

Evidence types:

- `manual_note`
- `transcript`
- `timestamp`
- `video_clip`
- `image`
- `ai_signal`
- `tap_marker`

A1 should support `manual_note` and `tap_marker` first.

## 9. Next Session Card Contract

Conceptual fields:

| Field | Meaning |
| --- | --- |
| `id` | Stable next card id. |
| `session_id` | Source session id. |
| `user_id` | Authenticated owner id. |
| `title` | Short mobile title. |
| `next_focus` | Main carryover. |
| `carryover` | Useful session learning to bring forward. |
| `reminders` | Short reminders for the next session. |
| `related_moment_ids` | Source moments behind the card. |
| `created_at` | Row creation time. |
| `updated_at` | Last update time. |

A1 next session card can be simple:

- `title`
- `next_focus`
- `carryover`
- `reminders`

## 10. Searchable Memory Contract

Searchable text should combine:

- session title
- session type
- focus
- player / team names
- summary
- moment titles
- raw inputs
- situation
- action
- outcome
- cause
- correction
- next focus
- tags

Purpose:

Ask Axis and Memory search should be able to find sessions without needing raw JSON.

Searchable text should be derived from accepted or reviewed memory. Unreviewed AI suggestions should be included carefully and labeled through review state rather than treated as verified truth.

## 11. API Contract

Desired future API behavior is documented here without implementation.

Existing route can stay:

### `GET /api/axis/sessions`

Future behavior:

- returns recent drafts and saved sessions
- returns enough fields for Recent Memory
- stays owner-scoped
- avoids raw debug payloads in product responses

### `POST /api/axis/sessions`

Future behavior:

- creates a draft session, or
- saves a completed A1 session with moments, summary, and next session card
- remains safe for typed/tap A1 fallback
- does not require camera, voice, video, or AI

Future behavior may support either:

1. Expanding `/api/axis/sessions` safely.
2. Adding nested moment routes later.

Possible future routes:

- `GET /api/axis/sessions`
- `POST /api/axis/sessions`
- `GET /api/axis/sessions/:id`
- `PATCH /api/axis/sessions/:id`
- `POST /api/axis/sessions/:id/moments`
- `PATCH /api/axis/moments/:id`
- `POST /api/axis/moments/:id/corrections`

Do not implement routes in this contract pass.

## 12. Client Mapping Contract

Current mobile A1 local state should map into backend memory later as follows:

| Current client state | Future backend object |
| --- | --- |
| Active session | Axis Session |
| Typed input | Axis Moment |
| Tap input / quick mark | Axis Moment |
| Correction chips | Axis Correction |
| Manual note | Axis Evidence with `manual_note` |
| Tap marker | Axis Evidence with `tap_marker` |
| Local carryover | Axis Next Session Card |
| Memory preview | Saved sessions query |
| Ask tab | Searchable session and moment memory |

Current local fields to preserve:

- `title`
- `playerName`
- `objective`
- `sessionType`
- `startedAt`
- `endedAt`
- `moments`
- `nextFocus`
- `savedState`

Current moment fields to preserve:

- `content`
- `createdAt`
- `elapsedSeconds`
- `interpretedTitle`
- `reviewState`
- `structure.situation`
- `structure.actor`
- `structure.action`
- `structure.outcome`
- `structure.cause`
- `structure.correction`
- `structure.evidence`
- `type`

## 13. Migration Plan

Do not write migrations until this contract is accepted.

Suggested phased approach:

### Phase 1: Extend session persistence only if safe

Smallest safe step:

- keep `/api/axis/sessions`
- preserve current draft behavior
- add support for saved/completed session metadata only if it does not break current draft rows
- add ended time, duration, focus, summary, next focus, and searchable text only after reviewing table compatibility

### Phase 2: Add moments table

Add owner-scoped A1 moments with the product-facing structure.

Typed and tapped moments should be first.

### Phase 3: Add corrections table

Persist user corrections and review states separately enough to audit how memory changed.

### Phase 4: Add evidence table

Begin with manual note and tap marker evidence.

Do not call something verified evidence until future Evidence/Witness rules exist.

### Phase 5: Add next session cards

Either:

- add a `axis_next_session_cards` table, or
- embed simple `next_session_card` JSON on sessions if the product remains A1-simple.

Choose the smallest safe option after implementation review.

### Phase 6: Add searchable text / indexing

Add derived searchable text once sessions and moments are stable.

Potential future implementation:

- generated `searchable_text`
- database index
- owner-scoped search API

Recommended smallest safe backend step first:

Extend existing session persistence only if it can preserve current `/api/axis/sessions` behavior. If not, add a parallel owner-scoped saved-session table and keep draft persistence untouched.

## 14. Runtime Protection Rules

Future implementation must not:

- break current `/api/axis/sessions`
- break auth
- remove local fallback
- require camera to create memory
- require mic to create memory
- require AI vision to create memory
- require ball tracking to create memory
- expose raw JSON in the main UI
- expose debug machinery
- create schema before this contract is accepted
- use user-editable metadata as authorization truth
- expose service-role keys in client code
- create public tables without owner-scoped RLS
- turn A1 memory into a raw AI demo

## 15. Acceptance

This document is accepted when it clearly defines:

- current backend state
- A1 memory requirement
- Axis Session contract
- Axis Moment contract
- Axis Correction contract
- Axis Evidence contract
- Next Session Card contract
- searchable memory contract
- API contract
- client mapping contract
- migration plan
- runtime protection rules

Before implementation begins, the next build prompt should explicitly say:

```text
Before changing schema or runtime, verify against docs/AXIS_A1_MEMORY_BACKEND_CONTRACT.md and docs/AXIS_DEFINITION_OF_DONE.md.
```
