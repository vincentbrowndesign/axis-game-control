import { NextResponse } from "next/server";

type RoboflowModel = "sam2" | "yolo_world" | "qwen_vl";

type RoboflowImageInput = {
  type?: "base64" | "url";
  value?: string;
};

type AxisContext = {
  sessionId?: string;
  cameraFacing?: "front" | "rear";
  fullBodyVisible?: boolean;
  bodyDetected?: boolean;
  poseConfidence?: number;
  stanceRead?: string;
  balanceRead?: string;
  kneeBendRead?: string;
  torsoLeanRead?: string;
  frameStatus?: string;
};

type RoboflowVisionRequest = {
  model?: RoboflowModel;
  image?: RoboflowImageInput;
  axisContext?: AxisContext;
  prompt?: string;
  objectPrompts?: string[];
  extraInputs?: Record<string, unknown>;
};

const workflowMap: Record<RoboflowModel, string | undefined> = {
  sam2: process.env.ROBOFLOW_SAM2_WORKFLOW_ID,
  yolo_world: process.env.ROBOFLOW_YOLO_WORLD_WORKFLOW_ID,
  qwen_vl: process.env.ROBOFLOW_QWEN_VL_WORKFLOW_ID,
};

const defaultYoloWorldPrompts = [
  "person",
  "basketball",
  "shoes",
  "feet",
  "hands",
  "rim",
  "cone",
  "chair",
  "tripod",
  "phone",
];

const defaultQwenPrompt =
  "Check if the full body is visible, whether feet are visible, whether the camera is too close, whether lighting is usable, and what the coach should adjust. Keep it short and practical.";

const aiPurposeByModel: Record<RoboflowModel, string> = {
  sam2: "Body/person segmentation support for sampled Axis body frames.",
  yolo_world: "Object detection around the athlete without replacing pose tracking.",
  qwen_vl: "Short visual reasoning about frame quality and body visibility.",
};

export async function GET(request: Request) {
  return NextResponse.json(buildHealthPayload(request));
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as RoboflowVisionRequest | null;
  const model = body?.model;
  const image = body?.image;

  if (!model || !isRoboflowModel(model)) {
    return NextResponse.json(
      { ok: false, error: "ROBOFLOW_MODEL_INVALID", reason: "Could not check frame" },
      { status: 400 },
    );
  }

  const workflowId = workflowMap[model];

  if (!image?.type || !image.value || !["base64", "url"].includes(image.type)) {
    return NextResponse.json(
      {
        ok: false,
        model,
        error: "IMAGE_PAYLOAD_MISSING",
        reason: "Image payload missing",
        debug: buildDebugPayload(request, model, workflowId, 400),
      },
      { status: 400 },
    );
  }

  if (image.type === "base64" && image.value.length > 1_500_000) {
    return NextResponse.json(
      {
        ok: false,
        model,
        error: "FRAME_TOO_LARGE",
        reason: "Frame too large",
        debug: buildDebugPayload(request, model, workflowId, 413),
      },
      { status: 413 },
    );
  }

  const imageInput: Required<RoboflowImageInput> = {
    type: image.type,
    value: image.value,
  };
  const apiKey = process.env.ROBOFLOW_API_KEY;
  const workspace = process.env.ROBOFLOW_WORKSPACE;

  if (!apiKey) {
    return NextResponse.json(
      {
        ok: false,
        model,
        error: "ROBOFLOW_API_KEY_MISSING",
        reason: "Roboflow API key missing",
        debug: buildDebugPayload(request, model, workflowId, 500),
      },
      { status: 500 },
    );
  }

  if (!workspace) {
    return NextResponse.json(
      {
        ok: false,
        model,
        error: "ROBOFLOW_WORKSPACE_MISSING",
        reason: "Roboflow workspace missing",
        debug: buildDebugPayload(request, model, workflowId, 500),
      },
      { status: 500 },
    );
  }

  if (!workflowId) {
    return NextResponse.json(
      {
        ok: false,
        model,
        error: "ROBOFLOW_WORKFLOW_ID_MISSING",
        reason: model === "qwen_vl" ? "Qwen workflow missing" : "Workflow ID missing",
        debug: buildDebugPayload(request, model, workflowId, 500),
      },
      { status: 500 },
    );
  }

  const endpoint = `https://serverless.roboflow.com/${encodeURIComponent(
    workspace,
  )}/workflows/${encodeURIComponent(workflowId)}`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: apiKey,
        inputs: buildModelInputs(model, imageInput, body),
      }),
    });

    const roboflowResult = await parseRoboflowResponse(response);
    const sanitizedResponseBody = sanitizeRoboflowBody(roboflowResult);

    if (!response.ok) {
      return NextResponse.json(
        {
          ok: false,
          model,
          workflowId,
          error: roboflowErrorCode(response.status),
          reason: roboflowErrorReason(response.status),
          status: response.status,
          sanitizedResponseBody,
          axisContext: body?.axisContext,
          debug: buildDebugPayload(
            request,
            model,
            workflowId,
            response.status,
            sanitizedResponseBody,
          ),
        },
        { status: response.status },
      );
    }

    return NextResponse.json({
      ok: true,
      model,
      workflowId,
      roboflowResult,
      axisContext: body?.axisContext,
      debug: buildDebugPayload(request, model, workflowId, response.status),
      aiUse: {
        purpose: aiPurposeByModel[model],
        summary: "Frame checked with Axis body context attached.",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "ROBOFLOW_NETWORK_ERROR",
        model,
        workflowId,
        reason: "Roboflow request failed",
        message: error instanceof Error ? error.message : "Roboflow request failed.",
        debug: buildDebugPayload(request, model, workflowId, 502),
      },
      { status: 502 },
    );
  }
}

function buildModelInputs(
  model: RoboflowModel,
  image: Required<RoboflowImageInput>,
  body: RoboflowVisionRequest,
) {
  const inputs: Record<string, unknown> = {
    image: {
      type: image.type,
      value: image.value,
    },
  };

  if (model === "yolo_world") {
    inputs.classes = body.objectPrompts?.length ? body.objectPrompts : defaultYoloWorldPrompts;
  }

  if (model === "qwen_vl") {
    inputs.prompt = body.prompt || defaultQwenPrompt;
    inputs.model_version = "Qwen 2.5 VL 72B";
  }

  Object.assign(inputs, body.extraInputs || {});
  return inputs;
}

function isRoboflowModel(model: string): model is RoboflowModel {
  return model === "sam2" || model === "yolo_world" || model === "qwen_vl";
}

async function parseRoboflowResponse(response: Response) {
  const text = await response.text();

  if (!text) return null;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export function buildHealthPayload(request: Request) {
  const env = {
    apiKeyPresent: Boolean(process.env.ROBOFLOW_API_KEY),
    workspacePresent: Boolean(process.env.ROBOFLOW_WORKSPACE),
    sam2WorkflowPresent: Boolean(workflowMap.sam2),
    yoloWorkflowPresent: Boolean(workflowMap.yolo_world),
    qwenWorkflowPresent: Boolean(workflowMap.qwen_vl),
  };
  const missing = [
    !env.apiKeyPresent ? "ROBOFLOW_API_KEY" : "",
    !env.workspacePresent ? "ROBOFLOW_WORKSPACE" : "",
    !env.sam2WorkflowPresent ? "ROBOFLOW_SAM2_WORKFLOW_ID" : "",
    !env.yoloWorkflowPresent ? "ROBOFLOW_YOLO_WORLD_WORKFLOW_ID" : "",
    !env.qwenWorkflowPresent ? "ROBOFLOW_QWEN_VL_WORKFLOW_ID" : "",
  ].filter(Boolean);

  return {
    ok: missing.length === 0,
    domain: request.headers.get("host") || "local",
    env,
    missing,
  };
}

function buildDebugPayload(
  request: Request,
  model: RoboflowModel,
  workflowId: string | undefined,
  statusCode?: number,
  sanitizedResponseBody?: unknown,
) {
  return {
    domain: request.headers.get("host") || "local",
    apiRouteUrl: new URL(request.url).pathname,
    model,
    workflowIdPresent: Boolean(workflowId),
    statusCode,
    sanitizedResponseBody,
  };
}

function roboflowErrorCode(status: number) {
  if (status === 401) return "ROBOFLOW_401";
  if (status === 404) return "ROBOFLOW_404";
  if (status >= 500) return "ROBOFLOW_500";
  if (status === 400 || status === 422) return "WORKFLOW_INPUT_MISMATCH";
  return "ROBOFLOW_REJECTED_INPUT";
}

function roboflowErrorReason(status: number) {
  if (status === 401) return "Roboflow returned 401";
  if (status === 404) return "Roboflow returned 404";
  if (status >= 500) return "Roboflow returned 500";
  if (status === 400 || status === 422) return "Workflow input mismatch";
  return "Roboflow rejected input";
}

function sanitizeRoboflowBody(body: unknown) {
  if (typeof body === "string") return body.slice(0, 1000);
  return body;
}
