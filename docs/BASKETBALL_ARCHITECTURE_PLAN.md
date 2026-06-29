# Axis Basketball Architecture Plan

Architecture:

- camera-first
- overlay-first
- AI-tagging-first

Core stack:

- Next.js frontend/control layer
- Browser `getUserMedia` for live camera
- Canvas/SVG for overlay
- Supabase/Postgres for sessions and overlay configs
- Browser `MediaRecorder` for recording later
- storage later
- FastAPI/Python later for AI worker
- OpenCV/YOLO later for detection
- OpenAI/Google AI later for overlay-aware event labeling

## 1. Product Purpose

Axis Basketball lets a coach open a camera and place basketball intelligence on top of live reality. The overlay becomes context for AI.

The first useful product is not upload analysis, manual tagging, or an AI report. The first useful product is a live camera view with a basketball-aware overlay that can be adjusted and saved.

## 2. Build Sequence

Use this exact sequence:

- Camera preview
- Overlay system
- Overlay calibration
- Save overlay setup
- Camera recording
- Save recording with overlay context
- Frame extraction
- AI detection
- Overlay-aware AI event tagging
- AI event review
- Clips
- Reports

## 3. First API Routes

- `POST /api/basketball/sessions/create`
- `GET /api/basketball/sessions`
- `GET /api/basketball/sessions/:id`
- `POST /api/basketball/overlays/save`
- `GET /api/basketball/overlays/:session_id`
- `POST /api/basketball/overlays/reset`

These routes support session creation and saved overlay setup. They do not need video upload, AI, detection, clips, or reports.

## 4. Later API Routes

- `POST /api/basketball/recordings/create`
- `POST /api/basketball/recordings/complete`
- `POST /api/basketball/frames/extract`
- `POST /api/basketball/ai/analyze`
- `GET /api/basketball/ai/events/:session_id`
- `POST /api/basketball/ai/events/:id/review`
- `POST /api/basketball/clips/generate`
- `GET /api/basketball/reports/:session_id`

These routes should wait until the live camera and overlay system are stable.

## 5. Data Objects

- Player
- Session
- OverlayPreset
- OverlayConfig
- OverlayTransform
- Recording
- FrameSample
- Detection
- AIEventCandidate
- ReviewedEvent
- ShotAttempt
- Clip
- CoachNote

## 6. MVP Rule

First version only needs:

- session creation
- camera preview
- overlay display
- overlay controls
- saved overlay configs

No upload.

No manual tags.

No AI yet.
