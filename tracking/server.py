"""
Axis Tracking Server — FastAPI WebSocket

Wraps AxisTrackingWorker in a WebSocket server so browser clients
can send frames and receive PERSON_TRACK_UPDATED events in real time.

Start:
    uvicorn tracking.server:app --host 0.0.0.0 --port 8001

Connect from browser:
    const ws = new WebSocket("ws://localhost:8001/ws/track?sessionId=abc123");
    ws.binaryType = "arraybuffer";

Send frames:
    // From canvas:
    canvas.toBlob(blob => blob.arrayBuffer().then(buf => ws.send(buf)), "image/jpeg", 0.85);
    // Or from ImageCapture API — same pattern.

Receive events:
    ws.onmessage = (e) => {
        const event = JSON.parse(e.data);
        // event.type === "PERSON_TRACK_UPDATED"
        // event.payload: AxisPersonTrack
    };

Architecture boundary:
    This server is the CV Adapter.
    It does not know athlete identity.
    It does not know session roster.
    It does not resolve trackId → athleteId.
    That mapping belongs to Axis Session (Next.js / Supabase layer).
"""

from __future__ import annotations

import uuid

import cv2
import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from tracking.worker import AxisTrackingWorker

app = FastAPI(title="Axis Tracking V1")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten in production to Axis domain
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok", "service": "axis-tracking-v1"}


@app.websocket("/ws/track")
async def track_websocket(websocket: WebSocket, sessionId: str = ""):
    """
    WebSocket endpoint. One connection = one session = one AxisTrackingWorker.

    Frame format: raw JPEG or PNG bytes (from canvas.toBlob or ImageCapture).
    Event format: JSON string, type PERSON_TRACK_UPDATED.
    """
    await websocket.accept()

    session_id = sessionId or str(uuid.uuid4())
    worker = AxisTrackingWorker(session_id=session_id)

    try:
        while True:
            raw = await websocket.receive_bytes()

            # Decode JPEG/PNG → BGR numpy array
            nparr = np.frombuffer(raw, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if frame is None:
                continue

            events = worker.process_frame(frame)

            for event in events:
                await websocket.send_text(event.to_json())

    except WebSocketDisconnect:
        pass
    except Exception as exc:
        try:
            await websocket.send_text(
                f'{{"type":"TRACKING_ERROR","message":"{str(exc)}"}}'
            )
        except Exception:
            pass
