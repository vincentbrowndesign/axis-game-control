# Axis Definition of Done

Status: ACTIVE

Purpose: Define what "done" means for Axis.

## 1. Purpose

This document defines what "done" means for Axis.

Nothing is done just because code compiles.

A build is only done if it protects the Axis product truth, preserves runtime foundations, respects mobile-first UI, creates or protects session memory value, and passes verification.

This standard applies to:

- build prompts
- coding agent tasks
- commits
- PR descriptions
- verification reports
- future refactors

## 2. Non-Negotiable Product Truth

Axis is a basketball session memory system.

Axis captures any basketball session, turns what happened into structured memory, and helps the user search, review, correct, export, and build from it.

The first product win is:

```text
Open phone
-> sign in
-> start session
-> type / talk / tap moment
-> end session
-> memory exists
```

Axis is not:

- a raw AI demo
- a debug dashboard
- a stat tracker
- a camera settings app
- a desktop docs UI
- a generic SaaS dashboard
- a disconnected feature pile

Axis is:

- a basketball session memory system
- mobile-first
- coach-friendly
- memory-first
- low-friction
- useful in real gym conditions

## 3. Required Source Docs

Every Axis build must obey the current active docs:

- `docs/AXIS_DEFINITION_OF_DONE.md`
- `docs/AXIS_INDEX.md`
- `docs/AXIS_PRODUCT_MAP.md`
- `docs/AXIS_5W1H_PRODUCT_MAP.md`
- `docs/AXIS_UI_VISUAL_LANGUAGE.md`
- `docs/AXIS_MOBILE_PRIORITY.md`
- `docs/AXIS_BUILD_MAP.md`
- `docs/capsules/AXIS_AUTH.md`
- `docs/capsules/AXIS_SESSION_MEMORY.md`
- `docs/capsules/AXIS_DATA_ASSET_LAYER.md`

If docs conflict, use this priority:

1. Definition of Done
2. Product Map / 5W1H
3. UI Visual Language
4. Mobile Priority
5. Build Map
6. Capsules
7. Archived/reference/future docs

Archived docs are not current build direction.

If a cleanup pass has moved a full source into `docs/reference/`, use the active replacement named in `docs/AXIS_INDEX.md` first, then use the reference doc for detail only.

## 4. Product Council Gate

Every build must pass the Axis Product Council.

Basketball Expert:
Does this respect basketball truth?

Product Designer:
Does this reduce friction and keep the UI clear?

Tech Guru:
Does this preserve reliability, auth, APIs, and safe runtime behavior?

Data Architect:
Does this create or protect structured memory?

AI/ML Lead:
Does this avoid fake certainty and respect model boundaries?

Marketing Genius:
Does this make the product easier to understand and sell?

Customer Operator:
Can this work in a real gym with bad Wi-Fi, one hand, noise, and time pressure?

## 5. Mobile-First Gate

Every user-facing Axis change must pass:

- mobile is the base experience
- desktop only widens/centers the mobile shell
- no desktop-first dashboard
- no crowded grids
- no tiny controls
- no hover-only behavior
- safe-area padding supported
- 44px minimum tap targets where practical
- one obvious primary action
- thumb-first controls
- no tables on mobile unless absolutely necessary

## 6. Session Memory Gate

Every Axis feature must answer:

- What session value does this create?
- How does it become structured memory?
- Where does the memory live?
- Can the user search/review/correct/build from it?
- Does it help before, during, after, or before the next session?
- Does it make tomorrow's session easier?

If a feature does not create memory, protect memory, reduce friction, improve review, support correction, or help the next session, it is not A1 priority.

## 7. A1 Fallback Gate

A1 must work even if:

- camera fails
- mic fails
- AI vision fails
- ball tracking fails
- internet is weak
- gym is loud
- user only types
- user only taps

Typed and tap input must still create memory.

The product cannot depend on perfect AI vision.

## 8. UI Visibility Gate

Show by default:

- Start Session
- session/auth state
- session type
- focus
- timer
- natural input
- last interpreted moment
- correction controls
- End Session
- Saved to Memory
- Search / Ask Axis
- Next Session Card
- recent memory preview

Hide by default:

- APIs
- routers
- model names
- raw detections
- track IDs
- confidence percentages
- FPS
- frame counts
- JSON
- rim setup on landing
- zones on landing
- calibration tools
- debug tools
- model selectors
- pipeline logs

Hidden tools can live in Tools, Axis Lab, or developer-only views.

## 9. Runtime Protection Gate

Unless explicitly requested, builds must not:

- change database schema
- touch Supabase migrations
- break `/api/axis/sessions`
- remove auth
- break sign in/sign out
- rename runtime code to Hyper Trophy
- touch CV routes
- touch Mux routes
- touch Trigger routes
- touch OpenAI routes
- touch video upload routes
- touch processing routes
- remove existing backend foundations

## 10. Language Gate

Use human basketball language.

Use:

- Start Session
- Talk, type, or tap what happened.
- Last interpreted moment
- Saved to Memory
- Ask Axis
- Next Session Card
- Got paint, missed the extra.
- Too slow getting back to horns.
- Feet too narrow.

Avoid:

- router
- inference
- classification
- object detection
- confidence score
- JSON
- frame count
- pipeline
- raw detection
- event payload

## 11. Build Prompt Requirement

Every future Axis build prompt must include:

- the product truth
- the first product win
- hard constraints
- mobile-first requirement
- hidden-by-default rules
- validation commands
- required final report format

Every prompt must say:

> Before calling this done, verify against `docs/AXIS_DEFINITION_OF_DONE.md`.

## 12. Commit Requirement

Every Axis commit must be explainable in this format:

```text
Commit purpose:
What changed:

Product value:
How this helps Axis become better session memory:

Protected foundations:
Auth:
/api/axis/sessions:
Database schema:
Supabase migrations:
Runtime routes:

UI check:
Mobile-first:
Hidden debug:
One primary action:
Basketball language:

Verification:
npx tsc --noEmit:
npm run build:
Known warnings:
Known issues:
```

## 13. Verification Report Requirement

Every coding-agent report must include:

Changed files:

- list files

Product result:

- what the user can do now

Definition of Done check:

- Product truth: PASS/FAIL
- Mobile-first: PASS/FAIL
- Session memory: PASS/FAIL
- A1 fallback: PASS/FAIL
- Runtime protection: PASS/FAIL
- UI visibility: PASS/FAIL
- Language: PASS/FAIL

Validation:

- `npx tsc --noEmit`: PASS/FAIL
- `npm run build`: PASS/FAIL

Final:

- `git status --short`

Do not hide failures.

Report existing warnings separately from new errors.

## 14. Done / Not Done Rule

A task is not done if:

- it only looks better but does not support session memory
- it breaks auth
- it breaks `/api/axis/sessions`
- it requires camera/AI to create memory
- it exposes debug machinery on the main UI
- it creates a desktop-first dashboard
- it adds machine language to user-facing UI
- it skips TypeScript/build validation
- it cannot explain before/during/after/next-session value

A task is done only when:

- it protects Axis as session memory
- it preserves runtime foundations
- it improves or protects mobile-first UX
- it supports the A1 loop
- it hides technical machinery by default
- it passes validation
- it reports changed files and status honestly

## 15. Acceptance

This document is accepted when it clearly defines:

- what "done" means for Axis
- product truth gate
- Product Council gate
- mobile-first gate
- session memory gate
- A1 fallback gate
- UI visibility gate
- runtime protection gate
- language gate
- build prompt requirement
- commit requirement
- verification report requirement

This document makes no runtime code changes.

This document makes no UI changes.

This document adds no features.
