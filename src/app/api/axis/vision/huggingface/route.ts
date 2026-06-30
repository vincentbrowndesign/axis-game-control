export const runtime = "nodejs";
export const maxDuration = 120;

type HfTask = "object_detection" | "segmentation" | "frame_reasoning";

type HuggingFaceVisionRequest = {
  task: HfTask;
  image: string; // base64 data URL
  axisContext?: Record<string, unknown>;
  prompt?: string;
};

const HF_MODELS: Record<HfTask, string> = {
  object_detection: "facebook/detr-resnet-50",
  segmentation: "facebook/mask2former-swin-base-coco-panoptic",
  frame_reasoning: "meta-llama/Llama-3.2-11B-Vision-Instruct",
};

export async function POST(request: Request) {
  const hfToken = process.env.HF_TOKEN;
  if (!hfToken) {
    return Response.json(
      { error: "HF_TOKEN_MISSING", debug: { hfTokenPresent: false } },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => null) as HuggingFaceVisionRequest | null;
  if (!body?.task || !body.image) {
    return Response.json({ error: "IMAGE_PAYLOAD_MISSING" }, { status: 400 });
  }

  const { task, image, axisContext, prompt } = body;
  const model = HF_MODELS[task];
  if (!model) {
    return Response.json({ error: "UNKNOWN_TASK" }, { status: 400 });
  }

  const base64Data = image.includes(",") ? image.split(",")[1] : image;
  const imageBytes = Buffer.from(base64Data, "base64");

  if (imageBytes.length > 2 * 1024 * 1024) {
    return Response.json({ error: "FRAME_TOO_LARGE" }, { status: 413 });
  }

  const apiUrl = `https://api-inference.huggingface.co/models/${model}`;

  try {
    let hfResponse: Response;

    if (task === "frame_reasoning") {
      const systemPrompt = "You are an athletic movement analyst. Analyze the provided basketball player frame and describe what you observe about their body position, stance, and movement.";
      const userPrompt = prompt || "Describe the athlete's body position, stance, balance, and any observable movement patterns in this frame.";
      const contextText = axisContext
        ? `\n\nAxis body context: ${JSON.stringify(axisContext, null, 2)}`
        : "";

      hfResponse = await fetch(apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${hfToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: {
            text: `${systemPrompt}\n\n${userPrompt}${contextText}`,
            image: base64Data,
          },
          parameters: { max_new_tokens: 512 },
        }),
      });
    } else {
      // object_detection and segmentation accept raw image bytes
      hfResponse = await fetch(apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${hfToken}`,
          "Content-Type": "application/octet-stream",
        },
        body: imageBytes,
      });
    }

    if (!hfResponse.ok) {
      const errText = await hfResponse.text().catch(() => "");
      console.error("HF_VISION_UPSTREAM_ERROR", { model, status: hfResponse.status, task, body: errText.slice(0, 300) });

      if (hfResponse.status === 401) return Response.json({ error: "HF_401" }, { status: 502 });
      if (hfResponse.status === 503) return Response.json({ error: "HF_MODEL_LOADING", retryAfter: 20 }, { status: 503 });
      return Response.json({ error: `HF_${hfResponse.status}` }, { status: 502 });
    }

    const result = await hfResponse.json();

    return Response.json({
      task,
      model,
      result,
      debug: {
        task,
        model,
        imageSizeBytes: imageBytes.length,
        hasAxisContext: Boolean(axisContext),
      },
    });
  } catch (err) {
    console.error("HF_VISION_NETWORK_ERROR", { err, model, task });
    return Response.json({ error: "HF_NETWORK_ERROR" }, { status: 502 });
  }
}
