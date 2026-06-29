# Axis Basketball Architecture Plan

Architecture:

- camera-first
- body-first
- pose-overlay-first
- AI-body-feed-first

## 1. Product Purpose

Axis Basketball lets a coach or player open a camera and turn live body movement into structured basketball context.

The first useful layer is the athlete's body, not court space. Axis reads pose landmarks, tracks body context over time, and creates a body timeline that future AI can use with video.

## 2. Build Sequence

Use this sequence:

- Start body session
- Choose front or rear camera
- Open camera preview
- Detect one body
- Draw pose landmarks on the live camera
- Track body frames over time
- Generate simple body reads
- Save body context locally first
- Add persistent body timeline storage later
- Add recording later
- Add AI body read analysis later
- Add coach review later
- Add reports only after real body evidence exists

## 3. First API Routes

The first MVP can run locally in the browser. Server routes should wait until persistence is needed.

Future body routes:

- `POST /api/basketball/body/sessions/create`
- `POST /api/basketball/body/frames/save`
- `GET /api/basketball/body/frames/:session_id`
- `POST /api/basketball/body/reads/save`

Court overlay routes were removed from the MVP path.

## 4. Later API Routes

- `POST /api/basketball/body/analyze`
- `GET /api/basketball/body/reads/:session_id`
- `POST /api/basketball/body/review`

These routes should wait until live pose tracking and body context are stable.

## 5. Data Objects

- Player
- BodySession
- CameraFacing
- BodyFrame
- PoseLandmark
- BodyCenter
- BodyRead
- BodyReadTimeline
- Recording
- BodyReadCandidate
- ReviewedBodyRead
- CoachNote

## 6. MVP Rule

First version only needs:

- session start
- front/rear camera choice
- camera preview
- body detection
- pose overlay
- simple body reads
- local body frame timeline

No court overlays in the MVP.

No manual tags.

No fake AI.

No clips or reports yet.
