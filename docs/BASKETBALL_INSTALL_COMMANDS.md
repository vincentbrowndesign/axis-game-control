# Axis Basketball Install Commands

Do not install everything at once.

Start with browser camera, Canvas/SVG overlay, Supabase, and Postgres. Add recording, AI workers, CV, and basketball data only when the product phase needs them.

## Phase 1: Camera + Overlay

This phase does not need Python, OpenCV, YOLO, uploads, tags, clips, or video hosting.

Goal: open the live camera, render a court overlay, and let the user adjust the overlay on top of reality.

Use the existing Next.js project.

```bash
npm install react react-dom
```

Supabase client can be installed now if the app will save sessions or overlay configs soon:

```bash
npm install @supabase/supabase-js
```

Use icons for simple overlay tools and controls:

```bash
npm install lucide-react
```

Only install Zustand if the project is already using it for shared client state:

```bash
npm install zustand
```

Phase 1 browser APIs need no package install:

- `navigator.mediaDevices.getUserMedia`
- Canvas
- SVG
- Pointer events
- CSS transforms

## Phase 2: Overlay Persistence

Goal: save overlay setup so the camera view can become structured basketball context.

Use:

- Supabase
- Postgres
- Next.js API routes

Client install:

```bash
npm install @supabase/supabase-js
```

No extra install is needed for Next.js API routes inside an existing App Router project.

Store:

- session id
- camera view metadata
- overlay type
- overlay opacity
- overlay transform
- court anchors
- created and updated timestamps

Keep this phase focused on persistence. Do not add CV or event tagging yet.

## Phase 3: Camera Recording

Goal: record the camera session after the overlay can be opened, adjusted, and saved.

The browser recording API needs no package install:

- Browser `MediaRecorder`
- Browser `Blob`
- Browser `URL.createObjectURL`

Storage options:

- Supabase Storage for simple MVP recording storage
- Cloudflare R2 later for object storage scale
- Mux later only for serious video hosting, playback, thumbnails, and clipping

Supabase client:

```bash
npm install @supabase/supabase-js
```

Mux, only when video hosting is a real product requirement:

```bash
npm install @mux/mux-node
```

Do not add AI tags or clip generation in this phase unless recording with overlay context is already reliable.

## Phase 4: AI Worker

Goal: analyze recorded video and saved overlay context outside the main browser flow.

Use Python for the worker after camera, overlay, persistence, and recording are stable.

```bash
python -m venv .venv
```

```bash
.venv\Scripts\activate
```

Install worker packages:

```bash
pip install opencv-python-headless ultralytics supervision rfdetr mediapipe norfair pandas polars numpy scipy scikit-learn fastapi uvicorn websockets pydantic requests python-dotenv matplotlib plotly
```

Packages included:

- `opencv-python-headless`
- `ultralytics`
- `supervision`
- `rfdetr`
- `mediapipe`
- `norfair`
- `pandas`
- `polars`
- `numpy`
- `scipy`
- `scikit-learn`
- `fastapi`
- `uvicorn`
- `websockets`
- `pydantic`
- `requests`
- `python-dotenv`
- `matplotlib`
- `plotly`

Use this phase for:

- frame extraction
- court-aware CV experiments
- object detection
- pose tracking
- multi-object tracking
- event candidates
- worker APIs

Do not run product truth directly from raw model output. Use confidence gates and coach review.

## Phase 5: Basketball Data

Goal: enrich reports, references, and research. This should not be required for the live overlay MVP.

Python packages:

```bash
pip install nba_api py_ball sportsipy
```

R packages:

```r
install.packages("hoopR")
install.packages("wehoop")
```

API:

- balldontlie API

Use basketball data for:

- report enrichment
- external context
- research
- examples
- validation datasets

Do not let external stats APIs become a blocker for the camera overlay loop.
