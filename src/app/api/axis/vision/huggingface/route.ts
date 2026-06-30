export const runtime = "nodejs";
export const maxDuration = 120;

type HuggingFaceVisionModel = "object_detection" | "segmentation" | "frame_reasoning";

type HuggingFaceVisionRequest = {
  model?: HuggingFaceVisionModel;
  task?: HuggingFaceVisionModel;
  image?: {
    type: "base64" | "url";
    value: string;
  } | string;
  axisContext?: Record<string, unknown>;
  prompt?: string;
};

const HF_MODELS: Record<HuggingFaceVisionModel, string> = {
  object_detection: process.env.HF_OBJECT_DETECTION_MODEL || "facebook/detr-resnet-50",
  segmentation: process.env.HF_SEGMENTATION_MODEL || "facebook/mask2former-swin-base-coco-panoptic",
  frame_reasoning: process.env.HF_FRAME_REASONING_MODEL || "Salesforce/blip-image-captioning-base",
};

export async function POST(request: Request) {
  const hfToken = process.env.HF_TOKEN;
  const domain = request.headers.get("host") || "unknown";
  const apiRouteUrl = new URL(request.url).pathname;

  if (!hfToken) {
    return Response.json(
      {
        ok: false,
        error: "HF_TOKEN_MISSING",
        message: "HF_TOKEN missing. Add it to Vercel env.",
        debug: { domain, apiRouteUrl, runtime: "server", hfTokenPresent: false },
      },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => null)) as HuggingFaceVisionRequest | null;
  const requestedModel = body?.model || body?.task;
  const image = normalizeImageInput(body?.image);

  if (!requestedModel || !HF_MODELS[requestedModel]) {
    return Response.json(
      {
        ok: false,
        error: "UNKNOWN_MODEL",
        message: "Vision model unavailable.",
        debug: { domain, apiRouteUrl, runtime: "server", hfTokenPresent: true },
      },
      { status: 400 },
    );
  }

  if (!image?.value) {
    return Response.json(
      {
        ok: false,
        error: "IMAGE_PAYLOAD_MISSING",
        message: "Image payload missing.",
        debug: {
          domain,
          apiRouteUrl,
          runtime: "server",
          model: requestedModel,
          hfTokenPresent: true,
        },
      },
      { status: 400 },
    );
  }

  const imageBytes = await getImageBytes(image);
  if (!imageBytes) {
    return Response.json(
      {
        ok: false,
        error: "IMAGE_PAYLOAD_MISSING",
        message: "Image payload missing.",
        debug: {
          domain,
          apiRouteUrl,
          runtime: "server",
          model: requestedModel,
          hfTokenPresent: true,
        },
      },
      { status: 400 },
    );
  }

  if (imageBytes.byteLength > 1_500_000) {
    return Response.json(
      {
        ok: false,
        error: "FRAME_TOO_LARGE",
        message: "Frame too large.",
        debug: {
          domain,
          apiRouteUrl,
          runtime: "server",
          model: requestedModel,
          imageSizeBytes: imageBytes.byteLength,
          hfTokenPresent: true,
        },
      },
      { status: 413 },
    );
  }

  const modelId = HF_MODELS[requestedModel];
  const upstreamUrl = `https://api-inference.huggingface.co/models/${modelId}`;

  try {
    const hfResponse = await fetch(upstreamUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${hfToken}`,
        "Content-Type": "image/jpeg",
        "x-wait-for-model": "true",
      },
      body: imageBytes,
    });

    const responseBody = await readHfResponse(hfResponse);
    const debug = {
      domain,
      apiRouteUrl,
      runtime: "server",
      upstreamUrl,
      method: "POST",
      model: requestedModel,
      modelId,
      hfTokenPresent: true,
      statusCode: hfResponse.status,
      imageSizeBytes: imageBytes.byteLength,
      hasAxisContext: Boolean(body?.axisContext),
      sanitizedResponseBody: sanitizeForDebug(responseBody),
    };

    if (!hfResponse.ok) {
      const error = hfErrorCode(hfResponse.status);
      return Response.json(
        {
          ok: false,
          error,
          message: hfErrorMessage(error),
          debug,
        },
        { status: hfResponse.status === 503 ? 503 : 502 },
      );
    }

    return Response.json({
      ok: true,
      task: requestedModel,
      model: requestedModel,
      result: responseBody,
      huggingFaceResult: responseBody,
      axisContext: body?.axisContext,
      summary: summarizeVisionResponse(requestedModel, responseBody),
      debug,
    });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("HF_VISION_NETWORK_ERROR", { error, model: requestedModel, upstreamUrl });
    }

    return Response.json(
      {
        ok: false,
        error: "HF_NETWORK_ERROR",
        message: "Could not check frame.",
        debug: {
          domain,
          apiRouteUrl,
          runtime: "server",
          upstreamUrl,
          method: "POST",
          model: requestedModel,
          modelId,
          hfTokenPresent: true,
        },
      },
      { status: 502 },
    );
  }
}

function normalizeImageInput(image: HuggingFaceVisionRequest["image"]) {
  if (!image) return null;
  if (typeof image === "string") {
    return { type: "base64" as const, value: image };
  }
  return image;
}

async function getImageBytes(image: { type: "base64" | "url"; value: string }) {
  if (image.type === "base64") {
    const rawBase64 = image.value.includes(",") ? image.value.split(",")[1] : image.value;
    return Buffer.from(rawBase64, "base64");
  }

  const response = await fetch(image.value);
  if (!response.ok) return null;
  return Buffer.from(await response.arrayBuffer());
}

async function readHfResponse(response: Response) {
  const text = await response.text().catch(() => "");
  if (!text) return null;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function hfErrorCode(status: number) {
  if (status === 401 || status === 403) return "HF_401";
  if (status === 404) return "HF_404";
  if (status === 400 || status === 422) return "HF_INPUT_MISMATCH";
  if (status === 503) return "HF_MODEL_LOADING";
  if (status >= 500) return "HF_500";
  return `HF_${status}`;
}

function hfErrorMessage(error: string) {
  if (error === "HF_401") return "Hugging Face token unauthorized. Check HF_TOKEN in Vercel.";
  if (error === "HF_404") return "Hugging Face model not found. Check model ID.";
  if (error === "HF_INPUT_MISMATCH") return "Hugging Face rejected the frame input.";
  if (error === "HF_MODEL_LOADING") return "Hugging Face model is loading. Try again.";
  if (error === "HF_500") return "Hugging Face request failed.";
  return "Vision result unavailable.";
}

function sanitizeForDebug(value: unknown) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  if (!text) return "";
  return text.length > 1200 ? `${text.slice(0, 1200)}...` : text;
}

function summarizeVisionResponse(model: HuggingFaceVisionModel, value: unknown) {
  if (model === "object_detection" && Array.isArray(value)) {
    return value.length ? "Objects checked" : "No objects returned";
  }

  if (model === "segmentation" && Array.isArray(value)) {
    return value.length ? "Body mask checked" : "No mask returned";
  }

  if (model === "frame_reasoning") {
    const text = extractGeneratedText(value);
    return text || "Frame AI ready";
  }

  return "Vision checked";
}

function extractGeneratedText(value: unknown) {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";
  const first = value[0] as { generated_text?: unknown } | undefined;
  return typeof first?.generated_text === "string" ? first.generated_text : "";
}
