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
    console.log("Request built", {
      endpoint: `https://detect.roboflow.com/${modelId}?api_key=<redacted>&confidence=35&overlap=30`,
      imageBytesApprox: Math.ceil(image.length * 0.75),
      modelId,
    });
    console.log("Request sent");
    const roboflowResponse = await fetch(endpoint, {
      body: image,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      method: "POST",
    });
    const result = (await roboflowResponse.json()) as RoboflowDetectionResponse & { error?: string };
    console.log("Response received", {
      ok: roboflowResponse.ok,
      status: roboflowResponse.status,
    });

    if (!roboflowResponse.ok) {
      console.error("Roboflow detection error", result);
      console.log("Calibration aborted", { reason: "roboflow_non_ok", status: roboflowResponse.status });
      return Response.json({ error: "Person detection failed." }, { status: 502 });
    }

    const predictions = Array.isArray(result.predictions) ? result.predictions : [];
    console.log("Prediction count", { predictions: predictions.length });

    const personDetections = getPersonDetections(predictions);
    const personConfidence = personDetections.reduce<number | null>((highest, prediction) => {
      if (typeof prediction.confidence !== "number" || !Number.isFinite(prediction.confidence)) return highest;

      return highest === null ? prediction.confidence : Math.max(highest, prediction.confidence);
    }, null);

    return Response.json({
      detections: predictions.map((prediction) => ({
        confidence: typeof prediction.confidence === "number" ? prediction.confidence : null,
        height: typeof prediction.height === "number" ? prediction.height : null,
        label: prediction.class ?? prediction.class_name ?? "unknown",
        width: typeof prediction.width === "number" ? prediction.width : null,
        x: typeof prediction.x === "number" ? prediction.x : null,
        y: typeof prediction.y === "number" ? prediction.y : null,
      })),
      imageHeight: typeof result.image?.height === "number" ? result.image.height : null,
      imageWidth: typeof result.image?.width === "number" ? result.image.width : null,
      model: modelId,
      personConfidence,
      predictionCount: predictions.length,
      visiblePeople: countVisiblePeople(predictions),
    });
  } catch (error) {
    console.error("Person detection route failed", error);
    console.log("Calibration aborted", { error, reason: "api_exception" });
    return Response.json({ error: "Person detection failed." }, { status: 500 });
  }
}
