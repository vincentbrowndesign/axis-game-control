# Axis Mobile Priority

Status: ACTIVE

Purpose: Keep Axis optimized for real gym use on a phone.

## Mobile Truth

Axis must work while the user is standing, moving, coaching, training, or between reps.

Desktop may center and slightly widen the mobile shell. Desktop must not become a separate dashboard.

## First Product Win

```text
Open phone
-> sign in
-> start session
-> type / talk / tap moment
-> end session
-> memory exists
```

## Mobile Requirements

- one obvious primary action
- thumb-friendly controls
- no horizontal overflow
- no crowded technical rows
- safe-area aware bottom controls
- no desktop sidebars on the main product screen
- readable in a gym
- usable without camera or voice
- local fallback when persistence is unavailable

## Main Mobile Surfaces

1. Start Session
2. Active Session
3. Input Dock
4. Last Interpreted Moment
5. Saved To Memory
6. Recent Memory Preview
7. Bottom Navigation

## Bottom Navigation

The active mobile shell uses:

- Session
- Ask
- Memory
- Players
- Tools

Tools is where advanced setup, build-map access, and hidden power belongs.

## Landing Prohibitions

Do not show these on landing:

- raw detections
- track IDs
- FPS
- frame counts
- model names
- API names
- JSON
- calibration
- zones
- provider names
- debug panels

## Failure Rule

If camera, mic, AI, auth, or network fails, the user must still be able to type or tap a moment and end with local memory.
