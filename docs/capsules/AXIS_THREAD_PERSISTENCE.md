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
- assistant Thread Board snapshots
- created, updated, and last-opened timestamps

Thread Board snapshots are saved with assistant messages. Old boards are not regenerated when a saved thread opens.

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

## Failure Behavior

Conversation remains usable if persistence fails.

The UI may show:

- Saving...
- Saved
- Not saved

Axis must never claim a thread is saved when the write failed, and local messages must not be discarded because of a persistence error.
