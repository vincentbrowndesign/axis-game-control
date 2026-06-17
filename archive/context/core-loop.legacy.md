# Axis Core Loop

Axis is a personal athletic continuity system.

Axis exports intelligent sports film.

Axis is sports overlay infrastructure, not a stats app.

Input:

- Camera

Output:

- Film with intelligence

The user-facing loop should feel like:

rep
-> clip
-> report
-> progress

The active export loop is:

camera
-> detection
-> event
-> overlay
-> export

Every session resolves into one object:

- session
- video
- events
- hidden derived results
- clips
- shots
- overlays

Surfaces should pull from that object instead of recalculating separate outputs.

Mux is the source of truth for film. Session end automatically starts Mux upload and export processing:

upload recording
-> store playback id
-> generate event timeline
-> generate clip anchors
-> generate overlays
-> create export queue

The current full-stack map is:

- OpenAI: interpretation, summaries, reports
- Roboflow: detection
- RF-DETR: ball, player, hoop
- ByteTrack: identity persistence
- Mux: video pipeline, playback, exports
- Supabase: storage, session objects

The product should still feel like:

one phone
-> one tripod
-> one athlete
-> automatic track, shoot, analyze, export, share

Player reports are generated from the same session object:

attempts
-> makes/misses
-> shot locations
-> release metrics
-> hours
-> attendance
-> player card/pdf/reel/timeline/progress graph

The active product loop is:

show up
-> check in
-> participate
-> history grows
-> leaderboard updates
-> return tomorrow

The stabilized product direction is:

identity
-> presence
-> participation
-> progression
-> history
-> leaderboard
-> ritual continuity

## Product Anchor

Presence is primary.

Participation is proof.

History is emotional infrastructure.

Axis should always make the athlete feel:

- I showed up.
- I put work in.
- My history grew.
- My place in the group changed.
- I have a reason to return.

## Active Runtime

The active product should prioritize:

- auth
- organization entry
- training/session start
- training/session completion
- participation history
- streaks
- leaderboard movement
- coach visibility into attendance and consistency

The current V1 route shape is intentionally small:

- `/`
- `/org/bridge/start`
- `/org/city2city/start`
- `/org/bridge/train`
- `/org/city2city/train`
- `/org/bridge/coach`
- `/org/city2city/coach`

## Surface Hierarchy

Every Axis screen should follow:

Top:
identity, organization, and presence signal.

Center:
one dominant ritual or active participation state.

Bottom:
history, streak, leaderboard, or continuity records.

## What Stays Underneath

Replay, upload, clips, voice, storage, media, computer vision, and intelligence are infrastructure layers. They can support memory and continuity later, but they do not define the active product surface.

Future systems must inherit from the loop instead of replacing it.

## Do Not Drift Into

- dashboards
- analytics software
- replay-first UX
- tactical coaching tools
- scouting systems
- speculative AI surfaces
- startup onboarding
- social feeds
- widget stacks
- abstract system language

If a feature does not support:

show up
-> participate
-> history grows
-> return tomorrow

it should not exist in the active runtime.
