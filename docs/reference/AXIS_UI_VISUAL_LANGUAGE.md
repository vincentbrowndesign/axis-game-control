Status: REFERENCE

Why moved: consolidated into the active design constitution and mobile priority docs.

Current replacement source: `docs/AXIS_DESIGN_CONSTITUTION.md` and `docs/AXIS_MOBILE_PRIORITY.md`

---

# Axis UI Visual Language

## Purpose

The Axis 5W1H Product Map defines what Axis is.

Axis UI Visual Language defines how Axis should feel on screen.

Axis is a basketball session memory system, so the interface must feel like a live basketball session turning into memory.

This document protects the product from drifting into a raw AI demo, stat tracker, camera settings app, debug dashboard, or crowded coaching gimmick.

This document is documentation only.

It does not change runtime behavior.  
It does not change UI.  
It does not add features.

---

## Approved Visual Direction

The approved mock establishes the first Axis visual direction:

> Dark athletic session memory UI.

The product should feel:

- coach-friendly
- mobile-first
- memory-first
- low-friction
- calm under pressure
- useful in a real gym
- sharp without becoming sci-fi
- structured without becoming a dashboard

The product should not feel like:

- a raw AI demo
- a debug dashboard
- a stat tracker
- a generic SaaS dashboard
- a camera settings app
- a crowded coaching app
- a Hudl clone
- a developer console
- an analytics product first

---

## 1. Core Visual Idea

Axis should visually feel like:

> A live session card turning into memory.

The UI should organize around the session lifecycle:

Start Session  
→ Capture what happened  
→ Interpret the moment  
→ Correct if needed  
→ Save to Memory  
→ Search / Ask Axis  
→ Create the Next Session Card

The main product objects are:

- Session Cards
- Moment Cards
- Memory Pages
- Correction Chips
- Evidence Attachments
- Next Session Cards

Axis should reject dashboard-first UI.

The main screen is not an analytics dashboard.

The main screen is a capture and memory surface.

---

## 2. Product Feel

Axis should look and feel:

- calm
- sharp
- structured
- athletic
- fast
- trustworthy
- practical
- focused
- premium but not flashy
- simple enough to use while coaching

Axis should avoid:

- sci-fi clutter
- excessive gradients
- tiny text
- too many panels
- too many buttons
- developer language
- raw model labels
- debug indicators in the main UI
- overexplaining the system
- making the coach babysit the app

The emotional target:

> I can open this in a loud gym, start fast, talk naturally, and trust that the session will become memory.

---

## 3. Visual Metaphor

Axis is not an AI brain.

Axis is closer to:

- a coach notebook
- a modern scorebook
- a film room index
- a player development journal
- a searchable memory system

The interface should combine:

- the speed of a stopwatch
- the clarity of a note card
- the structure of a coach report
- the usefulness of film review
- the memory of a player development file

---

## 4. Screen Hierarchy

Axis screens should follow a simple hierarchy.

### Landing

The landing screen should answer:

> What are we working on today?

Show:

- Start Session
- Ask Axis
- Memory
- Players
- Tools

The primary action is always:

> Start Session

Secondary actions are:

- Ask Axis
- Memory
- Players
- Tools

Hide advanced setup on landing.

Do not show rim setup, zones, calibration, model controls, APIs, routers, detections, or debug tools on landing.

### During Session

The live session screen should answer:

> What are we doing right now?  
> What just happened?  
> Did Axis understand it correctly?

Show:

- timer
- live session state
- session type
- focus
- tap input
- voice input
- typed input
- last interpreted moment
- correction controls
- recent moments
- End Session

The live session screen should be usable one-handed.

It should work while the coach is moving, talking, watching players, and managing the floor.

### After Session

The after-session screen should answer:

> What did Axis remember?

Show:

- Session Complete
- Saved to Memory
- session summary
- key moments
- corrections
- View Full Memory Page
- Ask Axis About This Session

The after-session experience should make memory feel real.

### Memory List

The memory list should answer:

> What sessions have we saved?

Show:

- search sessions
- recent sessions
- session type
- date
- duration
- focus/context
- moment count

Avoid dense database tables.

Use session cards.

### Memory Page

The memory detail page should answer:

> What happened in this session, and what can we build from?

Show:

- moments
- summary
- notes
- clips
- structured moment cards
- cause
- correction
- evidence
- review/correction controls

### Ask Axis

Ask Axis should answer:

> What can I find across my basketball memory?

Show:

- natural language search
- session answers
- related moments
- timestamps
- evidence
- session references

Ask Axis is not generic chat.

Ask Axis is search and reasoning over session memory.

### Next Session Card

The Next Session Card should answer:

> What should we work on next?

Show:

- next focus
- key reminders
- related moments
- Start Next Session

This is the retention loop.

Axis wins when yesterday's memory makes today's plan easier.

---

## 5. Main UI Objects

### Session Card

A Session Card represents one basketball session.

It should show:

- session type
- date
- duration
- focus
- participants if available
- moment count
- saved state
- optional thumbnail/evidence preview

Session Cards are used in:

- landing context
- memory list
- player pages
- search results
- next session planning

### Moment Card

A Moment Card represents one meaningful thing that happened.

It should show:

- timestamp
- plain-language moment title
- situation
- action
- outcome
- cause
- correction
- evidence preview
- review state

A Moment Card should be structured, not vague.

Bad:

- GOOD_READ
- BAD_REP
- MAKE
- MISS

Better:

- Got paint, missed the extra pass.
- Too slow getting back to horns.
- Feet too narrow on closeout.
- Jumped to catch and kept the advantage.

### Correction Chip

A Correction Chip is a small control that lets the user correct Axis quickly.

Examples:

- Correct
- Refine
- Not Right
- Needs Review
- Decision
- Timing
- Spacing
- Footwork
- Base
- Evidence

Correction Chips should be fast and obvious.

They should not require the coach to enter a complex edit screen during live action.

### Evidence Attachment

Evidence Attachments connect memory to proof.

Evidence can include:

- timestamp
- transcript
- video clip
- image
- coach note
- player note
- AI signal
- manual tag

Evidence should support the memory without becoming the whole product.

Video is evidence.

Memory is the product.

### Memory Page

A Memory Page is the saved page created from a session.

It should include:

- session summary
- moment list
- corrections
- evidence
- searchable text
- related player/team context
- next focus
- export options when needed

### Next Session Card

A Next Session Card turns memory into a plan.

It should include:

- next focus
- carryover correction
- key reminders
- related moments
- start next session action

The Next Session Card should be short and action-oriented.

---

## 6. Visual Structure Rules

Axis UI should follow these rules:

1. One primary action per screen.
2. Big tap targets.
3. Mobile-first spacing.
4. Short labels.
5. Plain basketball language.
6. Memory-first organization.
7. Hide technical controls by default.
8. Show what the coach needs now.
9. Put advanced controls in Tools or Axis Lab.
10. Make the last interpreted moment visible.
11. Make correction easy.
12. Make saved memory feel valuable.
13. Avoid dense tables on mobile.
14. Avoid setup-heavy landing screens.
15. Avoid forcing camera, mic, or AI vision before memory can be created.

---

## 7. Color Language

Color should be functional, not decorative.

Axis should use color to communicate state and meaning.

### Core Color Roles

#### Active Session

Use the active color for:

- Start Session
- live recording state
- primary action
- session in progress
- End Session emphasis when needed

In the approved mock, this role is represented by orange.

#### Saved Memory

Use a distinct positive/saved color for:

- Saved to Memory
- completed moments
- memory confirmation
- verified session objects

In the approved mock, this role is represented by green.

#### Needs Review

Use a caution color for:

- uncertain interpretation
- medium confidence
- needs coach review
- unclear evidence
- correction required

In the approved mock, this role is represented by yellow.

#### Correction

Use a strong alert/correction color for:

- Not Right
- fix needed
- incorrect interpretation
- correction action

In the approved mock, this role is represented by red.

#### Evidence

Use a cool color for:

- clip
- video
- timestamp
- image
- searchable evidence
- source attachment

In the approved mock, this role is represented by blue.

#### Neutral Text / UI

Use neutral tones for:

- cards
- metadata
- inactive tabs
- separators
- quiet labels
- supporting text

### Color Rules

- Do not overload the UI with color.
- Color should support meaning.
- Primary action color should be consistent.
- Avoid using color only as decoration.
- Every color should answer what state something is in.

---

## 8. Typography Language

Typography should make Axis readable in a real gym.

Rules:

- large readable session title
- clear moment labels
- short metadata
- strong visual hierarchy
- no tiny technical labels
- no dense stat tables on mobile
- no code-like labels in user-facing UI
- use plain basketball language
- use sentence-style moment descriptions

### Preferred Label Style

Use:

- Start Session
- Live Session
- Last Interpreted Moment
- Saved to Memory
- View Full Memory Page
- Ask Axis
- Next Focus
- Start Next Session

Avoid:

- Initialize Capture
- Event Router
- Inference Output
- Detection Stream
- Classification Confidence
- JSON Object
- Frame Analysis
- Pipeline Result

---

## 9. Component Language

The A1 component set should include:

### Start Session Button

Primary landing action.

Should be large, obvious, and easy to tap.

### Session Type Selector

Allows the user to choose context.

Examples:

- Practice
- Game
- Training
- Shooting
- Scrimmage
- Film
- Camp
- Tryout

### Focus Field

Answers:

> What are we working on today?

Examples:

- Team Offense
- Transition Defense
- Finishing
- Shooting
- Closeouts
- Ball Screen Reads
- Weak Hand
- Extra Pass

### Natural Input Bar

Allows:

- talk
- type
- tap

The input should feel natural, not technical.

### Last Moment Card

Shows what Axis just interpreted.

This is the most important live session object besides the timer.

It should show:

- moment title
- tags
- evidence if available
- correction controls

### Correction Chips

Fast feedback controls.

Examples:

- Correct
- Refine
- Not Right

### End Session Button

Clear action to finish the session and produce memory.

### Saved to Memory Confirmation

Confirms that the session became memory.

Should feel rewarding and trustworthy.

### Search / Ask Axis Bar

Lets user search across saved sessions.

Should support natural language.

### Next Session Card

Turns memory into the next plan.

Should be simple, visual, and actionable.

---

## 10. Hidden By Default

The main Axis UI should hide technical machinery by default.

Hide:

- APIs
- routers
- model names
- raw detections
- raw track IDs
- confidence percentages
- FPS
- frame counts
- JSON
- rim setup on landing
- zones on landing
- calibration tools
- debug tools
- model selection
- pipeline logs
- raw transcript streams
- camera diagnostic panels

Hidden does not mean removed.

These can live in:

- Tools
- Axis Lab
- advanced setup
- session-specific setup
- developer/debug-only views

### Placement Rule

If it helps the user capture or review a session, it can be user-facing.

If it helps configure capability, it belongs in Tools.

If it helps experiment, test, debug, or train the system, it belongs in Axis Lab.

If it only helps developers, it belongs in developer tools.

---

## 11. A1 Visual Target

The first useful Axis version should visually support:

Start Session  
→ talk / type / tap what happened  
→ Axis shows last interpreted moment  
→ user corrects if needed  
→ End Session  
→ Saved to Memory  
→ Summary  
→ Next Session Card

A1 must still feel complete even without:

- camera
- mic
- AI vision
- ball tracking
- perfect internet
- perfect gym conditions

Typed and tap input must still create memory.

### A1 Visual Promise

A coach should be able to:

1. open Axis
2. start a session
3. talk/type/tap moments
4. see Axis structure the last moment
5. correct it quickly
6. end the session
7. get a saved memory page
8. see the next session focus

If that works, Axis is a product.

Everything else is capability expansion.

---

## 12. User-Facing Language Rules

Axis language should be natural, basketball-specific, and memory-oriented.

Use language like:

- What are we working on today?
- Got paint, missed the extra pass.
- Too slow getting back to horns.
- Feet too narrow.
- Saved to Memory.
- Ask Axis about this session.
- Next Focus.
- Start Next Session.

Avoid language like:

- Router event generated.
- Classification complete.
- Object detected.
- Confidence score.
- JSON saved.
- Frame count.
- API response.
- Model inference.

### Principle

The user should feel like they are coaching basketball, not operating software.

---

## 13. Decision Test

Every UI decision must answer:

1. Does this make session capture easier?
2. Does this help memory feel real?
3. Does this reduce friction?
4. Does the coach need this during a live session?
5. Should this live on the main screen, in Tools, or in Axis Lab?
6. Does this support before, during, after, or next session value?
7. Does this help Axis become searchable memory?
8. Can the screen still work if camera, mic, or AI vision fails?
9. Would this make a parent/player/coach understand value faster?
10. Does this protect Axis from becoming a debug dashboard?

### UI Placement Test

Main UI:

- Start Session
- live input
- last interpreted moment
- correction
- summary
- saved memory
- search
- next session

Tools:

- camera setup
- mic setup
- hoop setup
- zones
- templates
- session settings
- export settings

Axis Lab:

- AI experiments
- detection tuning
- confidence review
- model comparison
- raw analysis
- dataset generation review

Developer Tools:

- JSON
- logs
- routers
- APIs
- frame counts
- FPS
- track IDs
- pipeline traces

---

## 14. Acceptance

This document is accepted when it clearly defines:

- Axis visual language
- the approved dark athletic session memory direction
- the live session card turning into memory metaphor
- main visual objects
- screen hierarchy
- visible vs hidden UI rules
- color language
- typography language
- component language
- A1 visual target
- UI decision test

It must support the Axis 5W1H Product Map.

It must protect the product from clutter.

It must make no runtime code changes.

It must make no UI changes.

It must add no features.

---

## Next Documents

After this document, the next docs should be:

1. `AXIS_A1_SESSION_OBJECT_CONTRACT.md`
2. `AXIS_MEMORY_PAGE_CONTRACT.md`
3. `AXIS_A1_BUILD_SEQUENCE.md`

The UI Visual Language should guide those docs so the contracts and build sequence support the user-facing product instead of pulling Axis back toward hidden machinery.
