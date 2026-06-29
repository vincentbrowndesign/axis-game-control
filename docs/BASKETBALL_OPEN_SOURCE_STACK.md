# Axis Basketball Open Source Stack

## 1. Core Product Goal

Axis Basketball turns camera reality into structured basketball understanding.

The first layer is live visual overlay on top of the camera. The user should be able to open a phone, see the court through the camera, and place simple court context directly over the real view. This is the foundation, not a decoration.

The overlay gives AI court context later. It tells the system where the court is, where meaningful zones are, how the camera is framed, and what spatial assumptions are safe to use.

AI tagging should come after the camera and overlay layer exists. Event tags should use the video plus saved overlay configuration, not video alone and not manual tagging as the main product loop.

Coach review comes after AI output. The coach should be correcting, confirming, or using the system's read, not doing all the structure work first.

## 2. Install Categories

- Browser camera
- Overlay rendering
- Overlay calibration
- Camera recording
- Frame extraction
- Computer vision
- Object detection
- Pose tracking
- Multi-object tracking
- Video processing
- AI event tagging
- Basketball data APIs
- Backend/API
- Database
- Frontend UI
- Realtime/live mode
- Clip generation
- Audio/voice
- Testing

## 3. Tool Table

| Tool | Install command | Status | What it does | Basketball use case | Axis priority | Build phase |
|---|---|---|---|---|---|---|
| Browser getUserMedia | Built into browser | Browser API | Opens live camera streams in web apps. | Start the live camera-first Axis experience. | High | Overlay |
| Browser MediaRecorder | Built into browser | Browser API | Records camera or media streams in the browser. | Record a session after overlay setup exists. | High | Recording |
| Canvas/SVG | Built into browser | Browser API | Draws interactive graphics over video. | Render court lines, zones, handles, and calibration controls. | High | Overlay |
| OpenCV | `pip install opencv-python` | Open source | Image processing, calibration, transforms, frame analysis. | Later court detection, frame quality checks, homography experiments. | Medium | AI Tagging |
| Ultralytics YOLO | `pip install ultralytics` | Open source with models | Object detection and tracking workflows. | Later player, ball, and object detection after recording exists. | Medium | AI Tagging |
| RF-DETR | `pip install rfdetr` | Open source | Transformer-based object detection. | Alternative detector for basketball objects or custom datasets. | Low | AI Tagging |
| Supervision | `pip install supervision` | Open source | CV utilities for detections, annotations, zones, and tracking helpers. | Inspect detections against saved court overlay zones. | Medium | AI Tagging |
| MediaPipe | `pip install mediapipe` or browser package | Open source | Pose, hand, and body landmark detection. | Later shooting form, stance, balance, and movement cues. | Medium | AI Tagging |
| Norfair | `pip install norfair` | Open source | Lightweight object tracking from detections. | Track players across frames after detector output exists. | Low | AI Tagging |
| ByteTrack | `pip install yolox` or implementation-specific package | Open source | Multi-object tracking algorithm. | Preserve player tracks across basketball possessions. | Medium | AI Tagging |
| FFmpeg | `brew install ffmpeg`, `choco install ffmpeg`, or `apt install ffmpeg` | Open source | Video transcoding, slicing, frame extraction, audio extraction. | Extract frames and clips from recorded sessions. | High | Recording |
| FastAPI | `pip install fastapi` | Open source | Python API framework. | CV worker API or analysis service behind the web app. | Medium | AI Tagging |
| Uvicorn | `pip install uvicorn` | Open source | ASGI server for Python APIs. | Run FastAPI CV services. | Medium | AI Tagging |
| WebSockets | Browser API, `npm install ws`, or FastAPI built-in support | Browser/API/open source | Bidirectional realtime messaging. | Send live overlay state, recording state, or future realtime reads. | Medium | Realtime/live mode |
| Supabase | `npm install @supabase/supabase-js` | Open source platform/API | Auth, Postgres, storage, realtime APIs. | Store users, sessions, overlay configs, recordings, and review state. | High | Review |
| Postgres | Service install or Supabase managed Postgres | Open source | Relational database. | Store overlay configs, sessions, event tags, clips, and reports. | High | Review |
| nba_api | `pip install nba_api` | Open source/API client | Python client for NBA stats endpoints. | Reference pro game data, not first-product youth/live camera reads. | Low | Reports |
| balldontlie | API client or direct HTTP | API | Basketball stats API. | Lightweight basketball data enrichment for reports. | Low | Reports |
| hoopR | `install.packages("hoopR")` | Open source/API client | R package for basketball data. | Research, validation, and external basketball datasets. | Low | Reports |
| wehoop | `install.packages("wehoop")` | Open source/API client | R package for women's basketball data. | Reference data for women's basketball coverage and reports. | Low | Reports |
| py_ball | `pip install py_ball` | Open source/API client | Python basketball stats API wrapper. | Research and stats enrichment outside the first live camera loop. | Low | Reports |
| Roboflow | SDK or hosted API | API/service with SDKs | Dataset management, model training, hosted inference. | Later custom basketball detection models and dataset operations. | Medium | AI Tagging |
| Deepgram | `npm install @deepgram/sdk` | API/SDK | Speech-to-text and audio intelligence. | Later coach voice notes during sessions. | Low | Review |
| ElevenLabs | `npm install @elevenlabs/elevenlabs-js` | API/SDK | Text-to-speech and voice APIs. | Optional voice playback for coaching summaries. | Low | Reports |
| OpenAI | `npm install openai` | API/SDK | Language, vision, and structured generation. | Explain tagged events, generate review text, and produce reports from evidence. | Medium | AI Tagging |
| Google AI | `npm install @google/genai` | API/SDK | Gemini language and vision models. | Optional second provider for event explanation and review summaries. | Low | AI Tagging |
| Mux | `npm install @mux/mux-node` | API/service | Video upload, playback, encoding, thumbnails, clipping. | Hosted playback and clip generation once recording flow is stable. | Medium | Clips |
| Cloudflare R2 / Stream | S3-compatible SDK or Cloudflare APIs | API/service | Object storage and video streaming. | Store recordings, serve playback, and manage Stream copies later. | Medium | Clips |

## 4. Recommended First Stack

Start with:

- Next.js
- Supabase
- Browser getUserMedia
- Canvas/SVG overlay
- Browser MediaRecorder later
- Postgres overlay configs

Do not start with OpenCV or YOLO.

OpenCV and YOLO become useful after the overlay and recording loop is working. The first build needs camera access, a stable overlay, calibration controls, saved overlay configs, and a recording path that preserves overlay context. CV should consume that structure later instead of trying to infer everything from raw video first.

## 5. First 10 Loops

1. Start session
2. Open camera
3. Show camera preview
4. Render overlay
5. Switch overlay mode
6. Adjust overlay opacity
7. Drag, scale, and rotate overlay
8. Save overlay setup
9. Record camera session
10. Save recording with overlay context

These loops keep Axis practical. The first startup milestone is not automatic stat detection. It is a reliable camera instrument that captures reality with enough structure for AI to become useful later.
