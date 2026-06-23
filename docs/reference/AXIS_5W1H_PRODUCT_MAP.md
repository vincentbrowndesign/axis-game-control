Status: REFERENCE

Why moved: consolidated into the smaller active product map.

Current replacement source: `docs/AXIS_PRODUCT_MAP.md`

---

# Axis 5W1H Product Map

## Purpose

Axis needs a stable product map so future builds optimize the product instead of rushing into disconnected features.

This document defines Axis through Who, What, Where, How, Why, and When.

Core product sentence:

> Axis is a basketball session memory system.

Expanded product sentence:

> Axis captures any basketball session, turns what happened into structured memory, and helps the user search, review, correct, export, and build from it.

This document is documentation only.

It does not change runtime behavior.
It does not change UI.
It does not add features.

---

## 1. WHO

### Axis Product Council

Axis is protected by a product council.

The council exists to keep Axis from becoming:

- a raw AI demo
- a debug dashboard
- an overbuilt coaching gimmick
- a disconnected feature pile
- a camera app pretending to be a product
- a stat tracker without memory
- a practice-only tool with no long-term value

The council roles are:

1. Basketball Expert
2. Product Designer
3. Tech Guru
4. Data Architect
5. AI / ML Lead
6. Marketing Genius
7. Customer Operator

Together, they protect the product from becoming messy.

### 1. Basketball Expert

Protects basketball truth.

Owns:

- what matters in practice
- what matters in games
- what matters in training
- what matters in shooting
- what matters in scrimmage
- what matters in film review
- basketball language
- session context
- useful teaching structures
- what is fake or misleading

Rejects:

- vague labels as core product truth
- fake stats
- AI claims that do not match basketball reality
- outputs that sound smart but do not help a coach or player improve

Prefers:

> Situation → Actor → Action → Outcome → Cause → Correction → Evidence

### 2. Product Designer

Protects convenience and clarity.

Owns:

- first screen
- live session flow
- tools hierarchy
- mobile usability
- friction reduction
- what stays hidden
- what appears when the user is tired, moving, coaching, or in a loud gym

Rejects:

- rim setup on landing
- zones on landing
- debug controls on landing
- crowded button rows
- technical words in normal UI
- setup-heavy flows

Prefers:

- Start Session
- Talk naturally
- Tap or type when needed
- Mark moments
- End Session
- Saved to Memory

### 3. Tech Guru

Protects feasibility, reliability, and architecture.

Owns:

- APIs
- routers
- camera behavior
- mic behavior
- persistence
- performance
- safe boot
- error handling
- fallbacks

Rejects:

- fragile auto-start behavior
- features that crash mobile
- unvalidated local state
- duplicate loops
- exposed implementation details
- flows that only work in perfect conditions

Prefers:

- capabilities hidden behind simple user actions
- typed fallback
- tap fallback
- voice when available
- camera when available
- safe, testable increments

### 4. Data Architect

Protects memory quality.

Owns:

- Axis Signals
- Axis Session Objects
- Axis Memory Pages
- searchable text
- correction history
- dataset examples
- structured exports

Rejects:

- loose notes with no structure
- unsearchable exports
- random event names
- data that cannot become memory
- data that cannot become training material

Prefers:

- every meaningful moment becomes structured memory
- every saved object can be searched, reviewed, corrected, exported, or reused

### 5. AI / ML Lead

Protects truthfulness and future learning.

Owns:

- classification confidence
- review states
- correction learning
- model boundaries
- dataset readiness
- what AI should and should not claim

Rejects:

- fake certainty
- pretending vision is reliable when it is not
- treating silence as a miss without shot-attempt evidence
- broad buckets that teach nothing

Prefers:

- high confidence = log
- medium confidence = needs review
- low confidence = note or uncategorized
- corrections improve future routing

### 6. Marketing Genius

Protects commercial clarity.

Owns:

- positioning
- buyer pain
- offer
- demo
- pricing path
- language customers understand

Rejects:

- esoteric product descriptions
- selling routers, APIs, or datasets first
- feature lists without pain or outcome
- AI jargon as the main pitch

Prefers:

- “Stop losing what happened.”
- “Record it. Talk through it. Axis remembers it.”
- “Every session becomes searchable basketball memory.”

### 7. Customer Operator

Protects real-world use.

Owns:

- practice conditions
- gym conditions
- game conditions
- bad Wi-Fi
- phone use
- parent usability
- operator usability
- time pressure
- one-hand operation

Rejects:

- workflows that require a coach to babysit the app
- too many taps before starting
- features that only work in perfect conditions
- tools that slow down the session

Prefers:

- works with typed input
- works with tap input
- works with voice
- works with camera when available
- starts fast
- produces a useful end summary

---

## 2. WHAT

Axis is a basketball session memory system.

Expanded:

> Axis captures any basketball session, turns what happened into structured memory, and helps the user search, review, correct, export, and build from it.

Axis is not:

- just a camera app
- just a stat tracker
- just a practice app
- just a game app
- just an AI vision demo
- just a notes app
- a debug dashboard

Axis supports:

- practice
- game
- training
- shooting
- scrimmage
- film review
- private workouts
- team workouts
- camps
- tryouts

### Product Boundary

Axis does not win by detecting everything.

Axis wins by remembering what matters.

The product is not “AI saw basketball.”

The product is:

> We did basketball work. Axis kept the memory. Now we can build from it.

---

## 3. WHERE

Axis exists in three layers:

1. Physical
2. Product
3. Technical

### Physical

Axis is used wherever basketball development happens:

- gym
- backyard
- game
- practice
- training session
- shooting session
- scrimmage
- film review room
- camp
- tryout

Axis has to work in real conditions:

- noise
- movement
- limited time
- imperfect camera angles
- bad Wi-Fi
- tired coaches
- distracted players
- parents wanting proof

### Product

Axis exists across multiple product surfaces:

- `/axis` capture page
- session memory page
- player page
- clip page
- biomechanics note page
- correction page
- dataset example page
- search / chat memory layer

Rule:

> The capture screen is not the whole product. The real product is the memory system created from the session.

`/axis` is the capture door.

The product is the memory system behind it.

### Technical

Axis lives technically across:

- browser / mobile device
- local memory first
- database persistence later
- API / router layer hidden underneath
- future AI / ML services
- future dataset layer

The technical layer should stay mostly invisible to the user.

The user should not feel like they are operating APIs, routers, models, detections, or debug tools.

The user should feel like:

> I started a session. I talked through what happened. Axis remembered it.

---

## 4. HOW

Axis turns reality into memory through a structured flow.

### Axis Flow

Session starts  
→ voice / tap / typed / video / AI signals come in  
→ Axis structures the signals  
→ each meaningful moment becomes an Axis Session Object  
→ objects become Axis Memory Pages  
→ user can search, ask, review, correct, export, and build the next output

### Core Structure

The strongest structure is:

> Situation → Actor → Action → Outcome → Cause → Correction → Evidence

This keeps Axis from becoming lazy notes or vague labels.

### Core Fields

#### Situation

What was happening?

Examples:

- advantage created
- shape transition
- defensive rotation
- catch decision
- shot preparation
- closeout attack
- press break
- spacing issue
- biomechanics issue

#### Actor

Who was involved?

Examples:

- player
- coach
- team
- defender
- ball handler
- screener
- cutter
- shooter

#### Action

What did they do?

Examples:

- paint touch
- extra pass
- return to horns
- widen base
- jump to catch
- attack closeout
- reject screen
- screen away

#### Outcome

What happened?

Examples:

- made shot
- missed shot
- turnover
- late transition
- extra pass missed
- advantage kept
- advantage lost
- correction needed

#### Cause

Why did it happen?

Examples:

- timing
- spacing
- decision
- balance
- footwork
- pace
- late recognition
- weak communication

#### Correction

What should change?

Examples:

- reset faster
- widen base
- pass one count earlier
- hold corner longer
- jump to catch
- sprint to shape
- keep advantage alive

#### Evidence

What supports the memory?

Examples:

- timestamp
- transcript
- video clip
- image
- coach note
- player note
- AI signal
- manual tag

### Reject Vague Core Labels

Axis should not use vague labels as the core product language.

Reject vague core labels like:

- `GOOD_READ`
- `BAD_READ`
- `GOOD_REP`
- `BAD_REP`
- `MAKE`
- `MISS`
- `ERROR`
- `SUCCESS`

Those labels can exist as secondary tags, but they cannot be the main memory structure.

Axis should prefer structured outputs.

### Example 1

Input:

> “They got paint but missed the extra.”

Output:

- situation: advantage created
- actor: ball handler / offense
- action: paint touch
- opportunity: extra pass available
- outcome: extra pass missed
- cause: decision / timing needs review
- correction: recognize help earlier and deliver the extra pass on time
- evidence: timestamp / transcript / video if available

### Example 2

Input:

> “Too slow getting back to horns.”

Output:

- situation: shape transition
- actor: team / offense
- action: return to horns
- outcome: late
- cause: timing
- correction: reset faster into horns
- evidence: timestamp / transcript / video if available

### Example 3

Input:

> “Feet too narrow.”

Output:

- situation: biomechanics
- actor: player
- action: base / stance
- outcome: unstable base
- cause: feet too narrow
- correction: widen base
- evidence: timestamp / transcript / video if available

---

## 5. WHY

Axis matters because basketball sessions disappear too easily.

A coach sees something.
A player does something.
A correction gets made.
A good rep happens.
A bad habit shows up.
A parent asks what changed.
A team needs the next focus.

Then the session ends and most of it is lost.

Axis exists to stop that loss.

### For Coaches

Axis helps coaches:

- stop losing what happened
- review sessions faster
- create tomorrow’s plan
- organize player development
- track carryover
- remember corrections
- build from session to session

Coach promise:

> I stop losing what happened.

### For Players

Axis helps players:

- see what they worked on
- see progress over time
- understand their next focus
- connect corrections to real reps
- build confidence through visible development

Player promise:

> I know what I’m working on and what comes next.

### For Parents

Axis helps parents:

- see proof of work
- understand development
- trust the training process
- know what the player is improving
- see why the next session matters

Parent promise:

> I can see progress and understand what we are working on.

### For the Business

Axis helps the business by turning sessions into reusable assets.

Every session can become:

- proof
- plan
- report
- clip
- dataset
- player page
- team memory
- paid recap
- correction log
- next session card
- development history

Business promise:

> Every session becomes an asset.

### Commercial Promise

Stop losing what happened.  
Record it.  
Talk through it.  
Axis remembers it.

---

## 6. WHEN

Axis creates value at four times:

1. Before session
2. During session
3. After session
4. Before next session

### Before Session

Axis creates value before the session by showing:

- last carryover
- today’s focus
- last setup / context
- player history
- unresolved corrections
- previous session notes

Before-session promise:

> Axis reminds you what to work on.

### During Session

Axis creates value during the session by capturing:

- voice signals
- tap signals
- typed signals
- video signals
- AI signals when available
- marked moments
- corrections
- meaningful events

During-session promise:

> Axis captures what happened with low friction.

### After Session

Axis creates value after the session by creating:

- session summary
- memory page
- clips
- notes
- corrections
- exports if needed
- player updates
- parent-ready proof

After-session promise:

> Axis turns the session into memory.

### Before Next Session

Axis creates value before the next session by creating:

- next session card
- carryover focus
- correction reminder
- player-specific plan
- team-specific plan
- proof of what needs to continue

Before-next-session promise:

> Axis turns memory into the next plan.

### Retention Rule

Axis must give the user a reason to open it again tomorrow.

The product wins when the user opens Axis tomorrow because yesterday’s memory made today’s plan easier.

---

## 7. A1 PRODUCT LOOP

A1 is the first useful version of Axis.

A1 does not require perfect AI vision.
A1 does not require ball tracking.
A1 does not require automatic stat detection.
A1 does not require perfect video.
A1 does not require a full database before it can prove value.

### A1 Loop

Start Session  
→ talk / type / tap what happened  
→ Axis structures it  
→ end session  
→ saved to memory  
→ summary + next session card

### A1 Must Work Even If

- camera fails
- mic fails
- AI vision fails
- ball tracking fails
- internet is weak
- the gym is loud
- the coach only has one hand free
- the session is moving fast

Typed and tap input must still create memory.

### A1 Product Truth

If Axis can remember a session from typed or tapped inputs, the product exists.

If Axis only works when vision works, the product is too fragile.

The first win is not automatic detection.

The first win is structured memory.

---

## 8. USER-FACING RULES

Axis should feel simple by default.

The user-facing product should expose the session flow, not the machinery underneath it.

### Show By Default

- Start Session
- session type
- focus
- timer
- natural input
- last interpreted moment
- correction controls
- Session Complete
- Saved to Memory
- Search / Ask Axis
- Next Session Card

### Hide By Default

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
- calibration objects
- debug tools

### Hide Does Not Mean Remove

Hidden tools can still exist.

They should live in the correct place:

- Tools
- Axis Lab
- advanced setup
- session-specific setup
- developer/debug-only views

The main UI should stay focused on session memory.

---

## 9. DECISION TEST

Every future feature must answer the Axis 5W1H decision test.

### Feature Decision Questions

1. Who is this for?
2. What session value does it create?
3. Where does it live: main UI, Tools, Axis Lab, or Memory?
4. How does it become structured memory?
5. Why would someone pay for it or use it again?
6. When does it create value: before, during, after, or next session?

### Build Decision Questions

Before building any feature, ask:

1. Does this help Axis turn a session into searchable memory?
2. Does this reduce friction or increase it?
3. Does the user need to see this, or should it live in Tools / Axis Lab?
4. Does this create structured data?
5. Can it work if camera, mic, or AI fails?
6. Can a coach use it during a real session?
7. Does it make the next session easier?
8. Does it help us sell the product?
9. Is it honest about confidence?
10. Does it support practice, game, training, shooting, scrimmage, or film?

### Placement Rule

If a feature is useful but distracting, it does not belong on the landing screen.

If a feature creates memory, it belongs in the product.

If a feature only helps debugging, it belongs in Axis Lab or developer tools.

If a feature does not create memory, reduce friction, improve review, support correction, or help the next session, it should not be prioritized.

---

## 10. ACCEPTANCE

This document is accepted when it clearly defines:

- Who makes decisions
- What Axis actually is
- Where Axis lives and where it is used
- How reality becomes memory
- Why anyone cares or pays
- When Axis creates value
- the A1 product loop
- user-facing vs hidden rules
- the decision test for future features

It must position Axis as session memory, not practice-only.

It must make no runtime code changes.

It must make no UI changes.

It must add no features.

---

## Next Documentation

After this document, the next docs should be:

1. `AXIS_A1_SESSION_OBJECT_CONTRACT.md`
2. `AXIS_MEMORY_PAGE_CONTRACT.md`
3. `AXIS_A1_BUILD_SEQUENCE.md`

This 5W1H document comes first because it defines what Axis is, why it matters, and how future builds should be judged.
