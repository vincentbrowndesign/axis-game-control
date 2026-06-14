---
name: axis-taste
description: Axis-specific UI taste rules. Prevents generic AI interfaces. Enforces the Axis visual identity on /axis, the shell, and any one-box surface.
origin: Axis (adapted from Taste-Skill)
tools: Read, Edit, Write
---

# Axis Taste Skill

## When to Activate

Any time you touch:
- `src/app/axis/page.tsx`
- Any Axis UI surface
- CSS or Tailwind classes in an Axis component
- Typography, spacing, color, or layout decisions

## Dials

These are Axis-specific. Do not use generic Taste-Skill defaults.

| Dimension        | Axis Value | Meaning |
|------------------|------------|---------|
| Layout variance  | 2 / 10    | Structural. Never asymmetric for decoration. |
| Motion intensity | 1 / 10    | Almost imperceptible. No spring physics. No bounce. |
| Visual density   | 8 / 10    | Dense. Small metadata. Big signal. |
| Color expression | 1 / 10    | Restrained. One lime accent maximum per surface. |
| Type scale range | 9 / 10    | Wide — from 11px archival metadata to 48px+ ritual text. |

## Typography Rules

```
PRIMARY    — oversized ritual text. 32–48px+. Font-weight 700–900.
             Used for: challenge text, check-in state, session status.

SECONDARY  — restrained label. 13–15px. Font-weight 400–500.
             Used for: constraint label, session metadata, streak count.

ARCHIVAL   — tiny metadata. 10–12px. Opacity 0.4–0.6.
             Used for: timestamps, IDs, version numbers, debug info.
```

Never use medium-weight body copy as a primary element. It reads as a productivity app, not an athletic OS.

## Color Rules

```
Background  — white. #fafaf9 base. #ffffff cards. Never dark as default.
Primary text — near-black. #1a1a18. Never pure #000000.
Accent      — muted green. #3d7a28. One per surface. Signal only.
Metadata    — rgba(26, 26, 24, 0.28) to rgba(26, 26, 24, 0.52)
Border      — rgba(26, 26, 24, 0.08) to rgba(26, 26, 24, 0.12)
```

**Never:** dark backgrounds as primary, SaaS blue, bright gradients, cyberpunk palettes, frosted glass as primary surface.

## Spacing Rules

```
Between challenge and input box — generous. 48px+ vertical.
Between messages in thread     — tight. 8–12px.
Input box bottom margin        — 0. Flush or near-flush to edge.
Side padding                   — 20–24px. Never full-bleed text.
```

## Layout Rules

```
TOP      — identity signal (small, restrained)
CENTER   — dominant ritual element (large, single focus)
BOTTOM   — thread + input (structural, not floating)
```

Never stack floating cards. Never use widget-based layouts. Structure is always integrated.

## The One-Box Rule

The input box is not a search bar. It is not a chat box. It is not a form field.

It is the ritual entry point.

Apply accordingly:
- No placeholder text that says "Type here..." or "Ask anything..."
- Placeholder should be an example of natural language ("I keep looking at the ball…")
- No rounded pill shape — use a structural rectangle with minimal rounding (4–6px)
- Mic button integrated, not floating
- No submit button visible unless actively needed

## What Axis UI Should Feel Like

Reference these, not Figma design systems:
- PS2 OS boot screen
- Apple Fitness ring summary
- Nike Run Club post-run screen
- Arena scoreboard overlays
- MiniDisc player display
- Old ESPN lower-third graphics

**Not:**
- SaaS dashboards
- Chat apps
- Fitness startup onboarding
- Productivity tools
- Analytics surfaces

## Before Shipping Any UI Change

Ask:
1. Does this feel calm?
2. Does it feel earned — like something you get to see after showing up?
3. Would it look correct on a gym scoreboard or a PS2 boot screen?
4. Is there more than one lime element? (Remove one.)
5. Is any text between 16–24px doing decorative work instead of signal work?

If any answer is wrong, adjust before pushing.
