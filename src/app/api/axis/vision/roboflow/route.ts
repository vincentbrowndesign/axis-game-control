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
  "defender",
  "tripod",
  "phone",
];

const defaultQwenPrompt =
  "Look at this training frame. Describe body visibility, framing quality, whether the full body is visible, whether feet are visible, and what the coach should adjust. Do not make medical claims. Keep it short and practical.";

const aiPurposeByModel: Record<RoboflowModel, string> = {
  sam2: "Body/person segmentation support for sampled Axis body frames.",
  yolo_world: "Object detection around the athlete without replacing pose tracking.",
  qwen_vl: "Short visual reasoning about frame quality and body visibility.",
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as RoboflowVisionRequest | null;
  const model = body?.model;
  const image = body?.image;

  if (!model || !isRoboflowModel(model)) {
    return NextResponse.json(
      { ok: false, error: "ROBOFLOW_MODEL_INVALID" },
      { status: 400 },
    );
  }

  if (!image?.type || !image.value || !["base64", "url"].includes(image.type)) {
    return NextResponse.json(
      { ok: false, model, error: "ROBOFLOW_IMAGE_MISSING" },
      { status: 400 },
    );
  }

  const imageInput: Required<RoboflowImageInput> = {
    type: image.type,
    value: image.value,
  };

  const apiKey = process.env.ROBOFLOW_API_KEY;
  const workspace = process.env.ROBOFLOW_WORKSPACE;
  const workflowId = workflowMap[model];

  if (!apiKey) {
    return NextResponse.json(
      { ok: false, model, error: "ROBOFLOW_API_KEY_MISSING" },
      { status: 500 },
    );
  }

  if (!workspace) {
    return NextResponse.json(
      { ok: false, model, error: "ROBOFLOW_WORKSPACE_MISSING" },
      { status: 500 },
    );
  }

  if (!workflowId) {
    return NextResponse.json(
      { ok: false, model, error: "ROBOFLOW_WORKFLOW_ID_MISSING" },
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

    if (!response.ok) {
      return NextResponse.json(
        {
          ok: false,
          model,
          workflowId,
          error: "ROBOFLOW_ERROR",
          status: response.status,
          roboflowResult,
          axisContext: body?.axisContext,
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
      aiUse: {
        purpose: aiPurposeByModel[model],
        summary: "Frame checked with Axis body context attached.",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        model,
        workflowId,
        error: "ROBOFLOW_NETWORK_ERROR",
        message: error instanceof Error ? error.message : "Roboflow request failed.",
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
    ...(body.extraInputs || {}),
  };

  if (model === "yolo_world") {
    const prompts = body.objectPrompts?.length ? body.objectPrompts : defaultYoloWorldPrompts;
    inputs.classes = prompts;
    inputs.prompts = prompts;
  }

  if (model === "qwen_vl") {
    inputs.prompt = body.prompt || defaultQwenPrompt;
    inputs.text = body.prompt || defaultQwenPrompt;
    inputs.query = body.prompt || defaultQwenPrompt;
  }

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
