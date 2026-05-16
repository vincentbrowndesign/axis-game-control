# Tech Layers

Axis grows in layers.

Each layer must preserve upload isolation, replay survivability, reward-first language, and confidence-gated reads.

## Layer 1 - Memory Infrastructure

- replay
- archive
- session
- Digital Twin
- warmup chains

This layer answers: what memory exists, who owns it, and which chain it belongs to.

## Layer 2 - Browser Perception

- frame sampling
- motion
- audio
- cadence
- camera stability

This layer runs after replay loads and must never block upload.

## Layer 3 - Pose + Geometry

- MediaPipe
- landmarks
- wrist paths
- stance
- release paths
- body rhythm

This layer observes structure over time. It does not grade skill.

## Layer 4 - Basketball Events

- rep segmentation
- dribble cycles
- shot windows
- footwork bursts
- transition bursts

This layer divides replay memory into behavioral units. It must avoid fake certainty.

## Layer 5 - External Signals

- Fitbit / Apple Watch / WHOOP
- heart rate
- load
- readiness
- recovery

This layer can add physiology and body context to memory. It must not claim injury prediction or fatigue certainty.

## Layer 6 - Hardware Expansion

- Insta360 / GoPro / phone mounts
- smart balls
- court cameras
- wearable capture kits

This layer improves capture and signal quality. It should not change the core product into hardware management.

## Layer 7 - AI Interpretation

- OpenAI Vision
- cloud workers
- model summaries
- comparison reads

This layer explains grounded signals after enough memory exists. It must not invent basketball claims.

## Layer Rule

Signals move upward into memory.

Memory remains the anchor.

The UI should show continuity, not machinery.
