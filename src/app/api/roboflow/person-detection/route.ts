import { NextResponse } from "next/server";

export const runtime = "nodejs";

type RoboflowPrediction = {
  class?: string;
  class_name?: string;
  confidence?: number;
  height?: number;
  width?: number;
  x?: number;
  y?: number;
};

type PersonDetection = {
  class: "person";
  confidence: number;
  height: number;
  width: number;
  x: number;
  y: number;
};

const defaultProject = "axis-kenetic-observer";
const defaultVersion = "1";

export async function POST(request: Request) {
  try {
    const frame = await readFramePayload(request);
    if (!frame) {
      return NextResponse.json(
        { detections: [], error: "FRAME_PAYLOAD_REQUIRED", visiblePeople: 0 },
        { status: 400 },
      );
    }

    const apiKey = process.env.ROBOFLOW_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { detections: [], error: "ROBOFLOW_API_KEY_REQUIRED", visiblePeople: 0 },
        { status: 500 },
      );
    }

    const project =
      process.env.ROBOFLOW_PERSON_PROJECT ??
      process.env.ROBOFLOW_PROJECT ??
      process.env.ROBOFLOW_BASKETBALL_PROJECT ??
      defaultProject;
    const version =
      process.env.ROBOFLOW_PERSON_VERSION ??
      process.env.ROBOFLOW_VERSION ??
      process.env.ROBOFLOW_BASKETBALL_VERSION ??
      defaultVersion;
    const endpoint = `https://detect.roboflow.com/${encodeURIComponent(project)}/${encodeURIComponent(
      version,
    )}?api_key=${encodeURIComponent(apiKey)}&confidence=35&overlap=30`;

    const response = await fetch(endpoint, {
      body: stripDataUrlPrefix(frame),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      method: "POST",
    });
    const body = (await response.json().catch(() => null)) as { predictions?: RoboflowPrediction[] } | null;

    if (!response.ok) {
      return NextResponse.json(
        {
          detections: [],
          error: "ROBOFLOW_REQUEST_FAILED",
          status: response.status,
          visiblePeople: 0,
        },
        { status: 502 },
      );
    }

    const detections = Array.isArray(body?.predictions)
      ? body.predictions.map(normalizeDetection).filter((detection): detection is PersonDetection => Boolean(detection))
      : [];

    return NextResponse.json({
      detections,
      visiblePeople: detections.length,
    });
  } catch (error) {
    console.error("ROBOFLOW_PERSON_DETECTION_FAILED", {
      error: error instanceof Error ? { message: error.message, name: error.name, stack: error.stack } : error,
    });
    return NextResponse.json(
      { detections: [], error: "ROBOFLOW_REQUEST_FAILED", visiblePeople: 0 },
      { status: 500 },
    );
  }
}

async function readFramePayload(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => null)) as
      | { frame?: unknown; image?: unknown; imageData?: unknown }
      | null;
    const frame = body?.frame ?? body?.image ?? body?.imageData;
    return typeof frame === "string" && frame.length > 0 ? frame : null;
  }

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const frame = form.get("frame") ?? form.get("image") ?? form.get("imageData");
    if (typeof frame === "string" && frame.length > 0) return frame;
    if (frame instanceof File) return bufferToBase64(await frame.arrayBuffer());
  }

  const text = await request.text().catch(() => "");
  return text.length > 0 ? text : null;
}

function stripDataUrlPrefix(frame: string) {
  const marker = ";base64,";
  const markerIndex = frame.indexOf(marker);
  if (markerIndex === -1) return frame;
  return frame.slice(markerIndex + marker.length);
}

function bufferToBase64(buffer: ArrayBuffer) {
  return Buffer.from(buffer).toString("base64");
}

function normalizeDetection(prediction: RoboflowPrediction): PersonDetection | null {
  const className = String(prediction.class_name ?? prediction.class ?? "").trim().toLowerCase();
  if (className !== "person") return null;

  return {
    class: "person",
    confidence: numberOrZero(prediction.confidence),
    height: numberOrZero(prediction.height),
    width: numberOrZero(prediction.width),
    x: numberOrZero(prediction.x),
    y: numberOrZero(prediction.y),
  };
}

function numberOrZero(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
