import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 15;

const DETECTOR_URL = (process.env.AXIS_VISION_DETECTOR_URL ?? "").replace(/\/$/, "");
const ROBOFLOW_API_KEY = process.env.ROBOFLOW_API_KEY ?? "";
const ROBOFLOW_WORKSPACE = process.env.ROBOFLOW_WORKSPACE ?? "";
const ROBOFLOW_PROJECT = process.env.ROBOFLOW_PROJECT ?? "axis-kinetic-observer";
const ROBOFLOW_VERSION = process.env.ROBOFLOW_VERSION ?? "1";

export type CvHealthResult = {
  overall: "degraded" | "offline" | "ready";
  roboflow: {
    configured: boolean;
    error?: string;
    latencyMs?: number;
    project?: string;
    reachable: boolean;
    validKey?: boolean;
    version?: string;
    workspace?: string;
  };
  yolo: {
    configured: boolean;
    error?: string;
    latencyMs?: number;
    reachable: boolean;
    url: string;
  };
};

export async function GET(): Promise<Response> {
  const [roboflow, yolo] = await Promise.all([checkRoboflow(), checkYolo()]);

  const overall: CvHealthResult["overall"] =
    roboflow.reachable || yolo.reachable
      ? roboflow.reachable && (roboflow.validKey ?? true)
        ? "ready"
        : "degraded"
      : "offline";

  return NextResponse.json({ overall, roboflow, yolo } satisfies CvHealthResult);
}

async function checkRoboflow(): Promise<CvHealthResult["roboflow"]> {
  if (!ROBOFLOW_API_KEY) {
    return {
      configured: false,
      error: "ROBOFLOW_API_KEY is not set.",
      reachable: false,
    };
  }

  // Use the Roboflow management API to validate the key and project without sending image data.
  // Returns project metadata if the project exists and the key is valid.
  const workspace = ROBOFLOW_WORKSPACE || "workspace";
  const url = `https://api.roboflow.com/${workspace}/${ROBOFLOW_PROJECT}/${ROBOFLOW_VERSION}?api_key=${ROBOFLOW_API_KEY}`;
  const start = Date.now();

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      method: "GET",
      signal: AbortSignal.timeout(6000),
    });

    const latencyMs = Date.now() - start;

    if (response.status === 200) {
      const data = (await response.json().catch(() => ({}))) as {
        version?: { name?: string };
        workspace?: { name?: string };
      };
      return {
        configured: true,
        latencyMs,
        project: ROBOFLOW_PROJECT,
        reachable: true,
        validKey: true,
        version: ROBOFLOW_VERSION,
        workspace: data.workspace?.name ?? ROBOFLOW_WORKSPACE,
      };
    }

    if (response.status === 401 || response.status === 403) {
      return {
        configured: true,
        error: "API key rejected — check ROBOFLOW_API_KEY.",
        latencyMs,
        reachable: true,
        validKey: false,
      };
    }

    if (response.status === 404) {
      return {
        configured: true,
        error: `Project "${ROBOFLOW_PROJECT}" version ${ROBOFLOW_VERSION} not found. Check ROBOFLOW_PROJECT and ROBOFLOW_VERSION.`,
        latencyMs,
        reachable: true,
        validKey: true,
      };
    }

    return {
      configured: true,
      error: `Roboflow responded with HTTP ${response.status}.`,
      latencyMs,
      reachable: true,
    };
  } catch (err) {
    return {
      configured: true,
      error: err instanceof Error ? err.message : "Network error.",
      latencyMs: Date.now() - start,
      reachable: false,
    };
  }
}

async function checkYolo(): Promise<CvHealthResult["yolo"]> {
  if (!DETECTOR_URL) {
    return {
      configured: false,
      error: "AXIS_VISION_DETECTOR_URL is not set.",
      reachable: false,
      url: "",
    };
  }

  const start = Date.now();

  // Try /health first, then / as fallback
  for (const path of ["/health", "/"]) {
    try {
      const response = await fetch(`${DETECTOR_URL}${path}`, {
        method: "GET",
        signal: AbortSignal.timeout(4000),
      });

      if (response.ok || response.status < 500) {
        return {
          configured: true,
          latencyMs: Date.now() - start,
          reachable: true,
          url: DETECTOR_URL,
        };
      }
    } catch {
      // Try next path
    }
  }

  return {
    configured: true,
    error: `Detector at ${DETECTOR_URL} did not respond within 4s.`,
    latencyMs: Date.now() - start,
    reachable: false,
    url: DETECTOR_URL,
  };
}
