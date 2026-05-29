type RoboflowPrediction = {
  class?: string;
  class_name?: string;
  confidence?: number;
  height?: number;
  width?: number;
  x?: number;
  y?: number;
};

type RoboflowDetectionResponse = {
  image?: {
    height?: number;
    width?: number;
  };
  predictions?: RoboflowPrediction[];
};

const personClasses = new Set(["person", "athlete", "player"]);

function getRoboflowModelId() {
  if (process.env.ROBOFLOW_MODEL_ID) return process.env.ROBOFLOW_MODEL_ID;

  const project = process.env.ROBOFLOW_PROJECT;
  const version = process.env.ROBOFLOW_VERSION;

  if (project && version) return `${project}/${version}`;

  return "";
}

function getImagePayload(image: unknown) {
  if (typeof image !== "string") return "";

  return image.replace(/^data:image\/[a-zA-Z]+;base64,/, "");
}

function countVisiblePeople(predictions: RoboflowPrediction[]) {
  return predictions.filter((prediction) => {
    const label = (prediction.class ?? prediction.class_name ?? "").toLowerCase();

    return personClasses.has(label);
  }).length;
}

function getPersonDetections(predictions: RoboflowPrediction[]) {
  return predictions.filter((prediction) => {
    const label = (prediction.class ?? prediction.class_name ?? "").toLowerCase();

    return personClasses.has(label);
  });
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.ROBOFLOW_API_KEY;
    const modelId = getRoboflowModelId();

    console.log("Roboflow runtime environment", {
      hasApiKey: Boolean(apiKey),
      hasModelId: Boolean(modelId),
      hasProject: Boolean(process.env.ROBOFLOW_PROJECT),
      hasVersion: Boolean(process.env.ROBOFLOW_VERSION),
      hasWorkspace: Boolean(process.env.ROBOFLOW_WORKSPACE),
      modelId,
      project: process.env.ROBOFLOW_PROJECT ?? null,
      version: process.env.ROBOFLOW_VERSION ?? null,
      workspace: process.env.ROBOFLOW_WORKSPACE ?? null,
    });

    if (!apiKey || !modelId) {
      return Response.json({ error: "Roboflow is not configured." }, { status: 500 });
    }

    const body = (await request.json()) as { image?: unknown };
    const image = getImagePayload(body.image);

    if (!image) {
      console.log("Calibration aborted", { reason: "api_missing_image" });
      return Response.json({ error: "Camera frame missing." }, { status: 400 });
    }

    const endpoint = `https://detect.roboflow.com/${modelId}?api_key=${apiKey}&confidence=35&overlap=30`;
    const redactedEndpoint = `https://detect.roboflow.com/${modelId}?api_key=<redacted>&confidence=35&overlap=30`;
    const outboundHeaders = {
      "Content-Type": "application/x-www-form-urlencoded",
    };
    console.log("Request built", {
      endpoint: redactedEndpoint,
      imageBytesApprox: Math.ceil(image.length * 0.75),
      modelId,
    });
    console.log("Roboflow outbound request", {
      bodyApproxBytes: Math.ceil(image.length * 0.75),
      headers: outboundHeaders,
      method: "POST",
      url: redactedEndpoint,
    });
    console.log("Request sent");
    const roboflowResponse = await fetch(endpoint, {
      body: image,
      headers: outboundHeaders,
      method: "POST",
    });
    const rawRoboflowBody = await roboflowResponse.text();
    let result: RoboflowDetectionResponse & { error?: string };

    try {
      result = JSON.parse(rawRoboflowBody) as RoboflowDetectionResponse & { error?: string };
    } catch (parseError) {
      console.error("Roboflow response JSON parse failed", {
        message: parseError instanceof Error ? parseError.message : String(parseError),
        rawBody: rawRoboflowBody,
        stack: parseError instanceof Error ? parseError.stack : null,
        status: roboflowResponse.status,
      });
      throw parseError;
    }
    console.log("Response received", {
      ok: roboflowResponse.ok,
      rawBody: rawRoboflowBody,
      status: roboflowResponse.status,
    });
    const predictions = Array.isArray(result.predictions) ? result.predictions : [];
    const detections = predictions.map((prediction) => ({
      confidence: typeof prediction.confidence === "number" ? prediction.confidence : null,
      height: typeof prediction.height === "number" ? prediction.height : null,
      label: prediction.class ?? prediction.class_name ?? "unknown",
      width: typeof prediction.width === "number" ? prediction.width : null,
      x: typeof prediction.x === "number" ? prediction.x : null,
      y: typeof prediction.y === "number" ? prediction.y : null,
    }));
    const debugPayload = {
      allClassNames: detections.map((detection) => detection.label),
      allConfidenceValues: detections.map((detection) => detection.confidence),
      detections,
      errorPayload: result.error ?? null,
      predictionCount: predictions.length,
      rawRoboflowResponse: result,
      rawRoboflowResponseBody: rawRoboflowBody,
      rawStatus: roboflowResponse.status,
      visiblePeople: countVisiblePeople(predictions),
    };

    console.log("Raw Roboflow debug response", debugPayload);

    if (!roboflowResponse.ok) {
      console.error("Roboflow detection error", {
        rawBody: rawRoboflowBody,
        result,
        status: roboflowResponse.status,
      });
      console.log("Calibration aborted", { reason: "roboflow_non_ok", status: roboflowResponse.status });
      return Response.json({ ...debugPayload, error: "Person detection failed.", personConfidence: null }, { status: 502 });
    }

    console.log("Prediction count", { predictions: predictions.length });

    const personDetections = getPersonDetections(predictions);
    const personConfidence = personDetections.reduce<number | null>((highest, prediction) => {
      if (typeof prediction.confidence !== "number" || !Number.isFinite(prediction.confidence)) return highest;

      return highest === null ? prediction.confidence : Math.max(highest, prediction.confidence);
    }, null);

    return Response.json({
      ...debugPayload,
      imageHeight: typeof result.image?.height === "number" ? result.image.height : null,
      imageWidth: typeof result.image?.width === "number" ? result.image.width : null,
      model: modelId,
      personConfidence,
      predictionCount: predictions.length,
      visiblePeople: countVisiblePeople(predictions),
    });
  } catch (error) {
    console.error("Person detection route failed", {
      error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : null,
    });
    console.log("Calibration aborted", {
      message: error instanceof Error ? error.message : String(error),
      reason: "api_exception",
      stack: error instanceof Error ? error.stack : null,
    });
    return Response.json({ error: "Person detection failed." }, { status: 500 });
  }
}
