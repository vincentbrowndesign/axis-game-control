# 01 Axis Understanding

## Purpose

Convert observations into understanding.

## Input

- Text
- Voice
- Image
- Video
- Coach Note

## Output

`AxisUnderstanding`

## Acceptance

Produces:

- Belief
- Confidence
- Current Pattern
- Target Pattern
- Experiment
- Evidence Request

## Runtime Contract

Every input source is treated as evidence about the player's development. The understanding layer does not render UI, create drills directly, or make dashboard claims. It produces one `AxisUnderstanding` object that downstream systems can use for demonstration, practice design, evidence requests, comparison, coaching, and development memory.

## Shape

```ts
interface AxisUnderstanding {
  belief: string;
  confidence: number;
  currentPattern: AxisPattern;
  targetPattern: AxisPattern;
  experiment: string;
  evidenceRequest: string;
}
```

## Success

Given any supported input, Axis can state what it currently believes, how confident it is, what pattern is happening now, what pattern should replace it, what to try next, and what evidence would clarify or confirm the understanding.
