# Axis Inference Layers
## Primitive Interface. Advanced Intelligence.

Axis:
Tally.
Time.
Behavior.

Maximum inference.
Minimum interaction.

Axis should become simpler on the surface while the engine becomes smarter underneath.

The human should only provide primitive truth:

- MAKE
- MISS
- Optional STREAM selection
- Optional UNDO

The engine should infer everything else from:

- Event sequence
- Elapsed time
- Spacing between events
- Changes in rhythm
- Repetition
- Recovery behavior
- Spurt patterns
- Long-term baseline drift

## 1. Product Philosophy

Axis is basketball behavior measured through tally marks and time.

The interface should stay primitive. The intelligence should happen underneath.

Main design laws:

1. Can this become simpler while the engine becomes smarter?
2. Can the engine infer more instead of asking the human?
3. Human input is expensive.
4. Every extra button must prove it is more valuable than inference.
5. The interface should stay primitive.
6. Intelligence should happen underneath.
7. Outputs must be measurable, not fake commentary.
8. Never expose debug language as product language.

Axis is not a form. Axis is not a stat sheet. Axis is not asking the coach to classify the world.

Axis should observe primitive events, preserve their chronology, and turn the shape of those events into behavioral memory.

## 2. Primitive Interface

The ideal Axis live interface contains only:

- MAKE
- MISS
- STREAM
- UNDO
- RECORD PLAY
- UPLOAD CLIP

Video is optional evidence. Replay should attach quietly and expand memory only when useful.

The primary product surface is not replay. The primary surface is the behavior fingerprint produced by tally marks and elapsed time.

## 3. Core Data Model

Streams are behavioral identities sharing one elapsed clock.

A session can contain one stream or multiple streams.

Scrimmages are just multiple streams sharing one clock. Do not create separate game mode language.

```ts
type Stream = {
  id: string
  label: string

  attempts: number
  makes: number
  misses: number

  metrics: StreamMetrics
}

type Session = {
  elapsedMs: number

  streams: Stream[]

  timeline: TimelineEvent[]
}
```

Core equations:

```txt
attempts = makes + misses

makeRate = makes / attempts

makesPerMinute = makes / (sessionSeconds / 60)

attemptsPerMinute = attempts / (sessionSeconds / 60)

avgInterval = average time between attempts

dropoff = earlyMakeRate - lateMakeRate

rushChange = (normalInterval - postMissInterval) / normalInterval

drought = longest time without a make

spurt = high-density event cluster inside a time window
```

## 4. Timeline Logic

Every primitive input creates a timeline event.

```ts
type TimelineEvent = {
  id: string
  type: "MAKE" | "MISS"
  streamId: string
  timestampMs: number
  elapsedLabel: string
  replayRef?: string
}
```

The timeline is not a visible feed by default. It is the engine substrate.

The timeline should answer:

- What happened?
- Who did it belong to?
- When did it happen?
- What happened before it?
- What happened after it?
- Did rhythm change?
- Did recovery change?
- Did the stream compress, drift, or collapse?

## 5. Stream Logic

A stream is a behavioral identity.

Examples:

- Black
- Gold
- AJ
- Coach V
- Corner Threes
- Floaters

Streams share the same elapsed session clock.

Each stream derives:

- Attempts
- Makes
- Misses
- Make rate
- Attempt intervals
- Droughts
- Spurts
- Recovery behavior
- Long-term comparison

The engine should not ask for extra labels when stream timing can explain the behavior.

## 6. Spurt Logic

Use "spurt," not "burst."

Spurts are time-compressed behavioral shifts.

Examples:

- 7 makes in 42 seconds.
- 4 scores in 31 seconds.
- 0 makes in 51 seconds.

Spurt types:

- HOT SPURT
- EMPTY SPURT
- FAST SPURT
- LONGEST STREAK
- LONGEST DROUGHT

Replay memory should group events into spurts.

Bad:

- MAKE
- MAKE
- MAKE
- MAKE

Good:

```txt
HOT SPURT
7 makes
42 seconds
```

Replay expands the memory. It is not nested UI.

## 7. Inference Layer List

### Foundation Layers

#### Attempts

- What it means: Total shot events recorded by primitive input.
- Input used: MAKE and MISS events.
- What it can infer: Workload, sample size, and whether a stream has enough data to trust other signals.
- Example output: `41 attempts recorded.`

#### Make Rate

- What it means: Ratio of makes to attempts.
- Input used: MAKE count and total attempts.
- What it can infer: Conversion level for a stream within the session.
- Example output: `20 / 41 made.`

#### Makes Per Minute

- What it means: Made shots normalized by elapsed session time.
- Input used: MAKE count and session seconds.
- What it can infer: Productive pace.
- Example output: `4.7 makes per minute.`

#### Attempts Per Minute

- What it means: Total attempts normalized by elapsed session time.
- Input used: Attempts and session seconds.
- What it can infer: Overall pace and workload density.
- Example output: `9.6 attempts per minute.`

#### Average Interval

- What it means: Average spacing between attempts.
- Input used: Timestamps between consecutive attempts.
- What it can infer: Baseline rhythm.
- Example output: `Most attempts came every 4-5 seconds.`

### Spurt Layers

#### Hot Spurts

- What it means: Dense clusters of makes in a short time window.
- Input used: MAKE timestamps.
- What it can infer: Productive compression.
- Example output: `Best spurt: 7 makes in 42 seconds.`

#### Empty Spurts

- What it means: Dense clusters of misses or time windows without makes.
- Input used: MISS timestamps and gaps between MAKE events.
- What it can infer: Empty compression and failed rhythm loops.
- Example output: `Empty spurt: 0 makes in 51 seconds.`

#### Fast Spurts

- What it means: Attempts occurring much faster than the stream baseline.
- Input used: Attempt intervals compared to average interval.
- What it can infer: Speed-up windows.
- Example output: `Fast spurt: 6 attempts in 18 seconds.`

#### Recovery Spurts

- What it means: Productive clusters immediately after misses or droughts.
- Input used: MISS events, following MAKE events, and elapsed spacing.
- What it can infer: How quickly a stream recovers from empty outcomes.
- Example output: `Recovery spurt: 3 makes in 19 seconds after two misses.`

#### Late Spurts

- What it means: Dense makes or attempts near the end of a session.
- Input used: Timestamp position within total elapsed session time.
- What it can infer: Late-session lift or late-session compression.
- Example output: `Late spurt: 5 makes in the final 48 seconds.`

### Streak Layers

#### Make Streaks

- What it means: Consecutive MAKE events.
- Input used: Ordered MAKE and MISS sequence.
- What it can infer: Longest uninterrupted productive run.
- Example output: `Longest make streak: 6.`

#### Miss Streaks

- What it means: Consecutive MISS events.
- Input used: Ordered MAKE and MISS sequence.
- What it can infer: Longest uninterrupted empty run.
- Example output: `Longest miss streak: 4.`

#### Streak Collapse

- What it means: The event pattern immediately after a make streak ends.
- Input used: End of MAKE streak, next attempts, and timing.
- What it can infer: Whether a stream resets, rushes, or slides after losing rhythm.
- Example output: `After the longest streak ended, the next 3 attempts came in 11 seconds.`

### Drought Layers

#### Longest Drought

- What it means: Longest elapsed time without a make.
- Input used: Time between MAKE events and session elapsed time.
- What it can infer: Largest empty stretch.
- Example output: `Longest empty stretch: 51 seconds.`

#### Drought Frequency

- What it means: Count of repeated empty stretches beyond a threshold.
- Input used: Gaps between MAKE events.
- What it can infer: Whether droughts are isolated or recurring.
- Example output: `Three empty stretches lasted longer than 30 seconds.`

#### Drought Recovery Speed

- What it means: Time from drought end to next productive cluster.
- Input used: Drought windows and following MAKE events.
- What it can infer: How quickly behavior repairs after empty time.
- Example output: `Recovered with 2 makes in 14 seconds after the longest drought.`

### Rhythm Layers

#### Rhythm Consistency

- What it means: How tightly attempt intervals cluster.
- Input used: Attempt interval distribution.
- What it can infer: Stable or scattered pacing, without naming it as a fake trait.
- Example output: `Most attempts came every 4-5 seconds.`

#### Rhythm Variance

- What it means: Spread between short and long attempt intervals.
- Input used: Attempt interval variance.
- What it can infer: How much timing changes during the session.
- Example output: `Attempt spacing ranged from 2 seconds to 11 seconds.`

#### Rhythm Drift

- What it means: Change in attempt spacing over time.
- Input used: Early, middle, and late interval averages.
- What it can infer: Whether the stream speeds up or slows down.
- Example output: `Average spacing moved from 6 seconds early to 3 seconds late.`

#### Rhythm Identity

- What it means: The stream's repeated timing signature across sessions.
- Input used: Long-term interval patterns.
- What it can infer: A baseline rhythm fingerprint.
- Example output: `This stream usually attempts every 4-6 seconds.`

### Recovery Layers

#### Response After Miss

- What it means: Timing and outcome pattern after MISS events.
- Input used: MISS events and the next attempt.
- What it can infer: Whether misses are followed by rushed, delayed, or productive attempts.
- Example output: `After misses, the next attempt came 44% faster.`

#### Rush Behavior

- What it means: Post-miss interval compression compared to normal interval.
- Input used: Normal interval and post-miss interval.
- What it can infer: Whether misses accelerate the next action.
- Example output: `Shoots 44% faster after misses.`

#### Reset Behavior

- What it means: Longer pause after misses before the next attempt.
- Input used: Post-miss intervals compared to baseline.
- What it can infer: Whether the stream slows down after misses.
- Example output: `After misses, the next attempt came 3 seconds slower than usual.`

#### Recovery Stability

- What it means: Consistency of outcomes after misses or droughts.
- Input used: Post-miss and post-drought sequences.
- What it can infer: Whether recovery behavior repeats.
- Example output: `After misses, 5 of the next 8 attempts were makes.`

### Pressure Layers

#### Pressure Response Style

- What it means: Behavior in high-compression or late-session windows.
- Input used: Late timing, fast intervals, misses, and recovery events.
- What it can infer: How behavior changes when the session compresses.
- Example output: `In the final minute, attempts came 38% faster.`

#### Decision Compression

- What it means: Shorter time between events during specific windows.
- Input used: Interval compression.
- What it can infer: Whether decisions are happening faster.
- Example output: `Attempt spacing dropped from 5 seconds to 2 seconds.`

#### Pressure Tolerance

- What it means: Make rate inside compressed windows compared to baseline.
- Input used: Fast-window make rate and normal-window make rate.
- What it can infer: Whether outcomes hold when timing compresses.
- Example output: `Fast-window make rate was 52% versus 49% overall.`

#### Collapse Windows

- What it means: Time windows where misses cluster after compression or streak ends.
- Input used: MISS clusters, fast intervals, and streak boundaries.
- What it can infer: When behavior breaks down measurably.
- Example output: `After the fastest 20-second window, the next 4 attempts were misses.`

### Fatigue Layers

#### Late Session Dropoff

- What it means: Early make rate compared to late make rate.
- Input used: Session split into time segments.
- What it can infer: Whether outcomes drop later.
- Example output: `Shot dropped from 68% early to 41% late.`

#### Fatigue Shape

- What it means: Pattern of pace and outcome change across the full session.
- Input used: Time-segmented make rate and interval drift.
- What it can infer: Whether decline is gradual, sudden, or absent.
- Example output: `Make rate held through the middle third, then dropped 18 points late.`

#### Endurance Stability

- What it means: Ability to preserve pace and output late.
- Input used: Late intervals, late make rate, and late spurts.
- What it can infer: Whether the stream maintains behavior over time.
- Example output: `Late attempts stayed within 1 second of the session average.`

### Adaptation Layers

#### Self-Correction

- What it means: Improvement after misses, droughts, or empty spurts.
- Input used: Recovery windows following negative events.
- What it can infer: Whether behavior adjusts without extra labels.
- Example output: `After the longest drought, 4 of the next 6 attempts were makes.`

#### Adaptation Speed

- What it means: Time required to return to productive behavior.
- Input used: Drought end, next MAKE events, and spurt timing.
- What it can infer: How quickly the stream changes course.
- Example output: `Recovered in 12 seconds after the empty spurt.`

#### Learning Curves

- What it means: Long-term improvement or decline across repeated sessions.
- Input used: Session history and baseline drift.
- What it can infer: Whether behavior is trending.
- Example output: `Longest drought is down from 51 seconds to 28 seconds over three sessions.`

### Attention / Cognitive Layers

#### Micro-Hesitation

- What it means: Small timing delays before specific outcomes.
- Input used: Attempt intervals before makes and misses.
- What it can infer: Whether longer pauses are associated with different results.
- Example output: `Attempts after pauses over 7 seconds were 6 / 9.`

#### Attention Stability

- What it means: Consistency of timing and outcomes across the session.
- Input used: Rhythm variance, streaks, and drought frequency.
- What it can infer: Whether behavioral timing stays organized.
- Example output: `Attempt spacing stayed inside a 3-second band for 22 attempts.`

#### Cognitive Load Windows

- What it means: Windows where timing compresses and outcomes change.
- Input used: Fast intervals, late windows, and miss clusters.
- What it can infer: When the stream appears measurably overloaded by pace.
- Example output: `During the fastest window, make rate fell from 55% to 33%.`

### Confidence Layers

#### Confidence Curves

- What it means: Outcome and pace pattern after makes or streaks.
- Input used: Post-make intervals, streak growth, and next outcomes.
- What it can infer: Whether makes lead to faster or more productive attempts.
- Example output: `After makes, the next attempt came 21% faster.`

#### Confidence Acceleration

- What it means: Speed-up after successful outcomes.
- Input used: Post-make intervals compared to baseline.
- What it can infer: Whether success increases pace.
- Example output: `After two straight makes, attempt spacing dropped to 3 seconds.`

#### Confidence Collapse

- What it means: Outcome drop after a productive streak ends.
- Input used: End of make streaks and following attempts.
- What it can infer: Whether a stream falls off after success breaks.
- Example output: `After the 6-make streak ended, the next 5 attempts were 1 / 5.`

### Energy Management Layers

#### Energy Distribution

- What it means: Where attempts and makes occur across elapsed time.
- Input used: Event density by time segment.
- What it can infer: Whether effort is front-loaded, balanced, or late-loaded.
- Example output: `52% of attempts came in the first third.`

#### Session Shape

- What it means: Overall contour of pace, output, droughts, and spurts.
- Input used: Full timeline, stream metrics, and spurt windows.
- What it can infer: The measurable behavioral fingerprint of the session.
- Example output: `Fast start, 51-second drought, late 5-make spurt.`

### Identity Layers

#### Behavioral Archetypes

- What it means: Repeated long-term behavior patterns.
- Input used: Baselines across sessions.
- What it can infer: Common stream shapes without reducing players to scores.
- Example output: `This stream usually starts fast and slows late.`

#### Rhythm Fingerprints

- What it means: Stable interval identity across sessions.
- Input used: Long-term attempt spacing distribution.
- What it can infer: A recognizable timing signature.
- Example output: `Typical rhythm: attempts every 4-6 seconds.`

#### Identity Stability

- What it means: How consistent stream behavior remains over time.
- Input used: Baseline drift and repeated metrics.
- What it can infer: Whether a stream's behavior is changing.
- Example output: `Attempt rhythm has stayed within 1 second across four sessions.`

### Prediction Layers

#### Behavior Forecasting

- What it means: Estimating near-future behavior from current session shape.
- Input used: Current pace, streaks, droughts, and baseline history.
- What it can infer: Expected next-window behavior.
- Example output: `At this pace, this stream projects 54 attempts in 6 minutes.`

#### Anticipatory Collapse Detection

- What it means: Identifying patterns that historically precede empty windows.
- Input used: Fast intervals, miss clusters, and long-term collapse windows.
- What it can infer: A measurable risk window.
- Example output: `The last two empty spurts started after attempts under 2 seconds apart.`

#### Future Drought Probability

- What it means: Estimating likelihood of another empty stretch from current pattern.
- Input used: Drought frequency, current rhythm, and recent miss sequence.
- What it can infer: Whether the current stream resembles prior drought setups.
- Example output: `Current spacing matches 3 previous drought starts.`

### Long-Term Memory Layers

#### Baseline Drift

- What it means: Movement of core metrics over time.
- Input used: Session history for a stream.
- What it can infer: Long-term change in behavior.
- Example output: `Average interval moved from 6 seconds to 4 seconds over five sessions.`

#### Behavioral Memory

- What it means: Stored history of session shapes and stream fingerprints.
- Input used: Prior sessions, stream metrics, spurts, droughts, and recovery patterns.
- What it can infer: What is normal, new, improving, or drifting.
- Example output: `This is the shortest longest-drought for this stream this month.`

## 8. Output Language Rules

Outputs must be measurable.

Avoid phrases like:

- Consistency spike
- Rhythm stable
- Fatigue detected
- Pressure score

Prefer measurable outputs:

- Best spurt: 7 makes in 42 seconds.
- Longest empty stretch: 51 seconds.
- Shot dropped from 68% early to 41% late.
- Shoots 44% faster after misses.
- Most attempts came every 4-5 seconds.

Never expose debug language as product language.

Never pretend Axis knows intent, emotion, fatigue, pressure, or confidence directly. Axis can describe measurable behavior that may support those future inference layers.

## 9. What Axis Should Not Do

Axis should not:

- Ask for complex tags during live capture.
- Add buttons before proving inference cannot solve the problem.
- Turn the interface into a stat sheet.
- Render one card per event as the default product surface.
- Make fake coaching claims.
- Use abstract model language in the product UI.
- Treat replay as the primary surface.
- Create separate game mode language.
- Use "burst" when the product language is "spurt."

Axis should not make the human classify what the engine can infer from sequence and time.

## 10. Future Engine Direction

The future Axis engine should move toward:

- Fewer visible controls.
- More inferred telemetry.
- Stronger stream baselines.
- Better spurt grouping.
- Better recovery modeling.
- Long-term behavioral memory.
- Optional replay evidence attached to inferred moments.
- Outputs that are short, measurable, and useful.

Every future engine layer should be judged by one question:

Can Axis understand more while asking the human for less?

Axis is not trying to make the user enter more.
Axis is trying to understand more from less.

Primitive interface.
Advanced intelligence.

Tally.
Time.
Behavior.
