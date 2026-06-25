# Axis Vision Field Test v1

Status: ACTIVE LAB CHECKLIST

Use this for the first real gym or iPad field test of Axis Vision / Axis Measure.

Axis Vision is still a Player + Ball + Rim lock flow. It is not a stats product or a full basketball analytics dashboard.

## Setup Checklist

- Charge the iPad or phone.
- Open `/vision`.
- Start in Product mode.
- Confirm camera permission works.
- Wait for detector readiness to move from `Warming up` to `Ready`.
- If readiness says `Slow`, keep testing but save Debug evidence.
- If readiness says `Offline`, check network and detector availability.
- Use Debug mode only when saving evidence or checking detector behavior.
- Do not judge the field test by stats. Judge it by player, ball, and rim lock quality.

## Camera Angle Checklist

- Place the device where the player stays mostly in frame.
- Avoid mirrors, glass, shiny walls, and bright scoreboards when possible.
- Keep the player away from the extreme screen edges.
- Include the rim if the session needs rim lock.
- If the rim is not visible, still use `Set Rim` and place the manual rim anchor where the rim should be.
- Keep enough floor visible to see the ball when it enters the frame.
- If Axis says `Step into frame`, move the player closer to the center.

## Product Flow

```text
Start camera
-> Axis sees the player
-> Set the rim
-> Bring in the ball
```

Product mode should stay simple:

- one primary player box
- ball box only when detected
- rim box only after manual placement
- bottom status for Player / Rim / Ball

## Rim Calibration

- Tap `Set Rim`.
- Read the instruction: `Tap where the rim is.`
- Tap the rim location or intended rim anchor.
- Drag the rim box into place.
- Use the large resize handle to adjust size.
- Tap `Lock Rim`.
- Use `Cancel` to exit without keeping an unlocked placement.

Rim is manual lock only in this version. Do not wait for model detection.

## Good Evidence

Save good evidence when:

- the primary player box stays on the real player
- the box is stable for several seconds
- the ball appears only when the ball is visible
- the rim anchor matches the real or intended rim
- the frame represents normal gym lighting and camera placement

Useful labels:

- `good_player_lock`
- `good_ball_lock`
- `good_rim_anchor`

## Bad Evidence

Save bad evidence when:

- reflections create player boxes
- a background person becomes P1
- the player is missed for more than a few seconds
- the ball is visible but not detected
- the rim box is placed badly or is hard to adjust
- the detector is slow or offline during a normal test

Useful labels:

- `bad_player_lock`
- `false_player`
- `missed_player`
- `missed_ball`
- `bad_rim_anchor`

## Export JSON After Session

1. Open `/measure/review`.
2. Review saved frames.
3. Accept useful examples.
4. Reject noisy examples that should not train behavior.
5. Delete accidental saves.
6. Tap `Export JSON`.
7. Keep the exported file with the field test notes.

## Field Test Notes

Write down:

- device used
- gym name or setup description
- camera position
- lighting issues
- detector readiness behavior
- whether player lock felt stable
- whether rim setup was easy
- whether ball detection appeared when expected

The goal is simple: make Axis Vision easier to trust in a real gym.
