# Axis Basketball API Inventory

Axis Basketball is not API-first. It is camera-overlay-first.

APIs support the camera, overlay, and AI tagging system. The product starts by turning a live camera view into structured court context.

Hierarchy:

1. Overlay creates context.
2. AI uses context.
3. Tags come from AI.

## Recommendation

### Now

- Browser getUserMedia
- Canvas/SVG
- Supabase
- Postgres

### Soon

- Browser MediaRecorder
- Storage
- Frame extraction

### Later

- OpenCV
- YOLO
- Roboflow
- OpenAI/Google AI event reasoning
- Deepgram/ElevenLabs
- Mux
- ShotTracker

## Inventory

| API or Tool | Type | What it is | Axis capability | Basketball-specific use case | Example Axis loop | Priority |
|---|---|---|---|---|---|---|
| Browser getUserMedia | Browser API | Native browser camera access through `navigator.mediaDevices.getUserMedia`. | Opens the live camera view without upload. | Let a coach point the phone at the court and start the Axis session. | Start session -> open camera -> show live court view. | Now |
| Browser MediaRecorder | Browser API | Native browser recording API for media streams. | Records camera sessions after overlay setup exists. | Save a possession, drill, rep, or timeout setup with camera context. | Open camera -> align overlay -> record -> save recording. | Soon |
| Canvas/SVG | Browser API | Native browser drawing and graphics layers. | Renders court overlays, zones, lines, handles, and calibration controls. | Place a court overlay on top of the live camera to define spatial context. | Open camera -> render overlay -> drag/scale/rotate -> save setup. | Now |
| Supabase | Open-source platform/API | Backend platform with Postgres, auth, storage, realtime, and server APIs. | Stores sessions, overlay configs, recordings, review state, and user-owned data. | Save a coach's court calibration and session memory. | Save overlay -> persist config -> reload session context. | Now |
| Cloudflare R2 / Stream | Paid API/service | Object storage through R2 and video streaming through Cloudflare Stream. | Stores original recordings and provides playback or streaming copies later. | Keep recorded sessions available for AI tagging and review. | Record camera -> upload original -> create playback copy -> analyze later. | Soon |
| Mux | Paid API/service | Video hosting, encoding, playback, thumbnails, and clipping platform. | Provides production-grade video hosting and clip workflows. | Generate clean clips from recorded possessions once the recording system is stable. | Save recording -> upload to Mux -> create playable clip -> review. | Later |
| OpenCV | Open source | Computer vision library for image processing, transforms, calibration, and frame analysis. | Helps with frame extraction, court detection experiments, and visual quality checks. | Use saved overlay context to verify court lines or frame geometry. | Recording saved -> extract frames -> compare to overlay -> flag quality. | Later |
| Ultralytics YOLO | Open source with model ecosystem | Object detection and tracking toolkit. | Detects players, ball, and visible basketball objects in recorded video. | Identify player/ball candidates after overlay and recording are stable. | Recording + overlay -> frame detection -> event candidates. | Later |
| Roboflow API | Paid API/service with SDKs | Dataset, model training, hosted inference, and annotation platform. | Supports custom basketball models and dataset operations. | Train or test custom court, player, ball, or action detectors. | Collect clips -> label frames -> train detector -> run inference. | Later |
| OpenAI | Paid API/SDK | Language, vision, and structured reasoning models. | Explains evidence, creates summaries, and reasons over event candidates. | Turn AI-tagged moments and overlay context into coach-readable reports. | Detections + overlay + tags -> generate Axis read. | Later |
| Google AI | Paid API/SDK | Gemini language and vision model APIs. | Optional model provider for multimodal reasoning and second-pass checks. | Cross-check event reasoning or generate alternate explanation. | Event candidates -> second-pass reasoning -> review text. | Later |
| Deepgram | Paid API/SDK | Speech-to-text and audio intelligence API. | Converts coach or player audio into session notes. | Capture sideline comments or spoken moment markers. | Record session audio -> transcribe -> attach note to moment. | Later |
| ElevenLabs | Paid API/SDK | Text-to-speech and voice API. | Creates optional spoken coaching summaries. | Read back a short teaching cue after a reviewed clip. | Axis read -> voice summary -> coach playback. | Later |
| nba_api | Open-source API client | Python client for NBA stats endpoints. | Adds external pro data references and research context. | Compare concepts to NBA examples or produce enriched reports. | Report topic -> fetch reference data -> add context. | Later |
| balldontlie | Open API/paid API depending on plan | Basketball stats API. | Provides lightweight basketball stats data. | Enrich reports with public basketball examples or references. | Generate report -> pull reference stat -> add context. | Later |
| hoopR | Open source | R package for basketball data access. | Research and dataset support for basketball analysis. | Pull college/pro basketball data for validation or examples. | Research question -> load data -> compare trend. | Later |
| wehoop | Open source | R package focused on women's basketball data. | Research and data access for women's basketball. | Support women's basketball examples and analysis references. | Report enrichment -> load reference dataset -> summarize context. | Later |
| py_ball | Open source | Python wrapper for basketball stats APIs. | Basketball data enrichment in Python workflows. | Add reference data to reports or analysis tools. | Worker task -> fetch stats -> attach to report context. | Later |
| ShotTracker API | Private API | Proprietary basketball tracking and shot data API where available through partnership. | Could provide verified tracking or shot event data if Axis has access. | Compare Axis-generated tags against verified sensor or tracking data. | Partner data -> validate Axis tags -> improve confidence gates. | Later |

## Build Order

Start with camera reality and overlay context:

1. Open the browser camera.
2. Render the overlay.
3. Calibrate the overlay.
4. Save the overlay config.
5. Record the camera session.
6. Save recording with overlay context.
7. Extract frames.
8. Run CV.
9. Let AI reason over video plus overlay context.
10. Create tags for coach review.

Do not make API availability the product starting point. The first product truth is the live camera plus the coach-aligned overlay.
