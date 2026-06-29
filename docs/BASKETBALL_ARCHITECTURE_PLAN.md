# Axis Basketball Architecture Plan

Architecture:

- full-body-first
- camera-first
- pose-overlay-first
- full-body frame gate first
- AI-body-feed-later

## 1. Product Purpose

Axis Basketball lets a coach or player open a camera and turn head-to-toe athlete movement into structured basketball context.

The first useful layer is full-body visibility. Axis should not call the read active until enough of the athlete is visible: head, shoulders, elbows, wrists, hips, knees, ankles, and feet when available.

## 2. Build Sequence

Use this sequence:

- Start full body session
- Choose front or rear camera
- Open camera preview
- Check full body visibility
- Detect one body
- Draw full-body pose landmarks on the live camera
- Gate reads until lower body and feet are visible
- Track full-body frames over time
- Generate simple full-body reads
- Build an AI body context object from the frame timeline
- Save full-body context locally first
- Add persistent full-body timeline storage later
- Add AI full-body read analysis later

## 3. First API Routes

The first MVP can run locally in the browser. Server routes should wait until persistence is needed.

Future body routes:

- `POST /api/basketball/body/sessions/create`
- `POST /api/basketball/body/frames/save`
- `GET /api/basketball/body/frames/:session_id`
- `POST /api/basketball/body/reads/save`

## 4. Later API Routes

- `POST /api/basketball/body/analyze`
- `GET /api/basketball/body/reads/:session_id`
- `POST /api/basketball/body/review`

These routes should wait until full-body pose tracking and full-body context are stable.

## 5. Data Objects

- Player
- FullBodySession
- CameraFacing
- FullBodyFrameStatus
- AxisFullBodyFrame
- PoseLandmark
- BodyStructure
- Base
- JointAngles
- Movement
- FullBodyReads
- AxisFullBodyAIContext
- BodyReadCandidate
- ReviewedBodyRead
- CoachNote

## 6. AI Body Context

AI should receive calculated context, not guess from a raw frame first:

- video frame later
- full-body pose landmarks
- full-body frame status
- body reads
- movement changes over time

The internal context object is `AxisFullBodyAIContext`:

- session id
- camera facing
- optional frame rate
- full-body frames
- summary counts
- average confidence
- most common frame issue
- body read timeline

AI may later summarize frame quality, body patterns, movement changes, and simple coaching cues. It must not claim medical biomechanics, perfect form judgment, player identity, court spacing, or automatic skill detection.

## 7. MVP Rule

First version only needs:

- session start
- front/rear camera choice
- camera preview
- full-body detection gate
- pose overlay
- simple full-body reads
- local full-body frame timeline

No court overlays in the MVP.

No manual tags.

No fake AI.

No clips or reports yet.
