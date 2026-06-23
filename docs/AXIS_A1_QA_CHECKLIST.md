# Axis A1 QA Checklist

Status: QA CHECKLIST ONLY

Current replacement source for product truth: `docs/AXIS_DEFINITION_OF_DONE.md`

Purpose: Provide a repeatable verification checklist for Axis A1 session memory persistence. This is not a product vision document and must not override the active build map or Definition of Done.

## 1. Signed-In Save / Reload

1. Open `/axis` on a phone-width viewport.
2. Sign in.
3. Start Session.
4. Add one typed moment.
5. Add one tap / quick-mark moment.
6. Use one correction chip: Correct, Refine, or Not Right.
7. End Session.
8. Confirm the UI says `Saved to Memory`.
9. Refresh `/axis`.
10. Confirm Recent Memory shows the restored session.
11. Open Memory.
12. Confirm restored moments appear.
13. Confirm the Next Session Card appears.

## 2. Signed-Out Local Fallback

1. Sign out.
2. Start Session.
3. Add one typed or tapped moment.
4. End Session.
5. Confirm the UI says `Saved locally` or `Sign in to save memory`.
6. Refresh.
7. Confirm local memory is still usable if local storage is available.

## 3. Failed-Save Fallback

1. Simulate unavailable auth or session save.
2. Start Session.
3. Add a moment.
4. End Session.
5. Confirm the session is not lost.
6. Confirm user-facing copy stays simple.
7. Confirm no route names, raw JSON, stack traces, or database wording appears in the main UI.

## 4. Memory Tab Restored Session

1. Open the Memory tab after a signed-in saved session exists.
2. Confirm the card shows:
   - Saved / Local / Needs sign in state
   - session type
   - date / time
   - focus or title
   - moment count
   - next-session carryover
3. Open a memory detail.
4. Confirm the last interpreted moment and correction are readable.

## 5. Ask Tab Restored Memory

1. Save a session with at least one structured moment.
2. Refresh.
3. Open Ask.
4. Ask: `What should we work on next?`
5. Confirm Axis answers from restored memory.
6. Ask about a term from the moment's situation, action, outcome, cause, or correction.
7. Confirm the restored memory can be found.

## 6. Correction Persistence

1. Add a moment.
2. Tap Correct.
3. End Session and refresh.
4. Confirm the saved moment remains accepted/corrected in the restored memory.
5. Repeat with Refine and Not Right.

## 7. Mobile Visual Check

1. Use phone-width viewport.
2. Confirm Session, Ask, Memory, Players, and Tools remain thumb-friendly.
3. Confirm bottom navigation does not cover the main action.
4. Confirm desktop only centers/widens the mobile shell.

## 8. Hidden Debug Check

The main `/axis` UI must not show:

- API
- route
- JSON
- payload
- schema
- migration
- database error
- stack trace
- inference
- classifier
- pipeline
- raw detections
- FPS
- frame count
- track IDs
