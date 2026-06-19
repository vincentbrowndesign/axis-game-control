# Axis Thread Persistence v0

Status: Active narrow capability
Build Decision: Build Now

## Product Rule

Axis Thread Persistence saves exact conversation threads so a user can reopen gameplans, player reads, huddle cues, and corrections before a game.

Persistence supports the current conversation product. It is not a dashboard, memory layer, player model, evidence system, or board-object persistence layer.

## What Is Saved

Axis saves:

- thread title
- owner id
- message order
- exact user messages
- exact assistant replies
- message timestamps
- assistant Thread Board snapshots
- created, updated, and last-opened timestamps

Thread Board snapshots are saved with assistant messages. Old boards are not regenerated when a saved thread opens.

The board snapshot time comes from the owning assistant message timestamp. ThreadBoardData does not own a separate timestamp field.

## What Is Not Saved

Axis Thread Persistence v0 does not save:

- long-term player memory
- inferred truth
- ActiveThreadContext
- cross-thread facts
- player models
- evidence
- confidence
- BoardSectionObject arrangement
- `board_items`
- local visual status
- upload, camera, voice, CV, or replay state

Board arrangement may reset when a thread reopens.

## Corrections

Corrections remain part of the transcript.

Axis should recompute active context from restored messages, not from a separate durable memory object. If the user corrects Lern to Liam, the correction is preserved as a message in order and should guide future responses in that thread.

## Thread Boundary

Each saved thread is separate.

Axis must not blend facts across unrelated saved threads in v0. Cross-thread retrieval, automatic player recall, and development memory remain future work.

## Access Boundary

Saved threads are owner-scoped.

The same signed-in user can reopen a thread across devices. Other users must not be able to read or write it.

## API Boundary

The conversation API remains unchanged:

```json
{
  "reply": "string",
  "threadBoard": null
}
```

Thread persistence routes save and restore transcript state around the conversation API. They do not change model response shape and do not introduce `board_items`.

## Continuity UI

Manual Save is part of the current `/axis` continuity UI.

Save states are:

- not_saved
- saving
- saved
- unsaved_changes
- error

Meanings:

- not_saved: no successful saved thread exists yet
- saving: a save request is currently in flight
- saved: every current persisted message revision has been saved successfully
- unsaved_changes: the thread exists, but local persisted content has changed since the last successful save
- error: the latest save attempt failed, local content remains intact, and the thread still has unsaved changes

Manual Save and autosave use the same active-thread save path.

The visible Saved time comes from the successful server save response. The preferred source is the thread `updated_at` value, because open/read behavior uses `last_opened_at`.

## Timestamp Boundary

Each saved user and assistant message has `created_at`.

Rules:

- local messages receive `createdAt` when they are committed to the transcript
- persisted messages restore their original timestamps exactly
- restored timestamps must not be replaced with the current time
- assistant Thread Board snapshots use the owning assistant message timestamp as their generated time
- BoardSectionObject arrangement may keep runtime-only movement timestamps, but those are not persisted and are not semantic board updates

## Failure Behavior

Conversation remains usable if persistence fails.

The UI may show:

- Saving...
- Saved
- Not saved

Axis must never claim a thread is saved when the write failed, and local messages must not be discarded because of a persistence error.
