import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type RoboflowModel = "sam2" | "yolo_world" | "qwen_vl";

type RoboflowPythonRequest = {
  model?: RoboflowModel;
  image?: {
    type?: "base64";
    value?: string;
  };
  prompt?: string;
  objectPrompts?: string[];
};

const execFileAsync = promisify(execFile);
const pythonRunnerEnabled =
  process.env.NODE_ENV === "development" || process.env.AXIS_ENABLE_PYTHON_ROBOFLOW === "true";

export async function GET() {
  return NextResponse.json({
    ok: pythonRunnerEnabled,
    available: pythonRunnerEnabled,
    message: pythonRunnerEnabled
      ? "Python Roboflow runner available."
      : "Python Roboflow runner not available in this environment.",
  });
}

export async function POST(request: Request) {
  if (!pythonRunnerEnabled) {
    return NextResponse.json(
      {
        ok: false,
        error: "PYTHON_RUNNER_UNAVAILABLE",
        message: "Python Roboflow runner not available in this environment.",
      },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => null)) as RoboflowPythonRequest | null;

  if (!body?.model || !isRoboflowModel(body.model)) {
    return NextResponse.json(
      { ok: false, error: "ROBOFLOW_MODEL_INVALID" },
      { status: 400 },
    );
  }

  if (body.image?.type !== "base64" || !body.image.value) {
    return NextResponse.json(
      { ok: false, error: "IMAGE_FILE_MISSING", message: "Image file missing" },
      { status: 400 },
    );
  }

  const workDir = path.join(tmpdir(), `axis-roboflow-${randomUUID()}`);
  const imagePath = path.join(workDir, "test-frame.jpg");
  const outputPath = path.join(workDir, "roboflow-result.json");
  const scriptPath = path.join(process.cwd(), "python", "axis_vision", "roboflow_workflows.py");

  try {
    await mkdir(workDir, { recursive: true });
    await writeFile(imagePath, Buffer.from(stripDataUrl(body.image.value), "base64"));

    const args = [
      scriptPath,
      "--model",
      body.model,
      "--image",
      imagePath,
      "--output",
      outputPath,
    ];

    if (body.prompt) {
      args.push("--prompt", body.prompt);
    }

    if (body.objectPrompts?.length) {
      args.push("--classes", body.objectPrompts.join(","));
    }

    const pythonCommand = process.env.PYTHON || "python";
    const result = await execFileAsync(pythonCommand, args, {
      cwd: process.cwd(),
      timeout: 120_000,
      windowsHide: true,
      maxBuffer: 1024 * 1024 * 8,
    }).catch(async (error: unknown) => {
      const output = await readRunnerOutput(outputPath);
      return {
        stdout: "",
        stderr: error instanceof Error ? error.message : "Workflow call failed",
        output,
      };
    });

    const payload = "output" in result ? result.output : await readRunnerOutput(outputPath);

    if (!payload) {
      return NextResponse.json(
        { ok: false, error: "ROBOFLOW_NO_RESULT", message: "Roboflow returned no result" },
        { status: 502 },
      );
    }

    if (!payload.ok) {
      return NextResponse.json(
        {
          ok: false,
          model: body.model,
          error: pythonErrorCode(payload.error),
          message: cleanPythonError(payload.error),
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      ok: true,
      model: body.model,
      roboflowResult: payload,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "WORKFLOW_CALL_FAILED",
        message: error instanceof Error ? error.message : "Workflow call failed",
      },
      { status: 502 },
    );
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

function isRoboflowModel(model: string): model is RoboflowModel {
  return model === "sam2" || model === "yolo_world" || model === "qwen_vl";
}

function stripDataUrl(value: string) {
  return value.includes(",") ? value.split(",").at(-1) || "" : value;
}

async function readRunnerOutput(outputPath: string) {
  const text = await readFile(outputPath, "utf-8").catch(() => "");
  if (!text) return null;

  try {
    return JSON.parse(text) as { ok?: boolean; error?: string };
  } catch {
    return null;
  }
}

function pythonErrorCode(error?: string) {
  if (error === "Missing Roboflow API key") return "ROBOFLOW_API_KEY_MISSING";
  if (error === "Missing workflow ID") return "ROBOFLOW_WORKFLOW_ID_MISSING";
  if (error === "Python dependency missing") return "PYTHON_DEPENDENCY_MISSING";
  if (error === "Image file missing") return "IMAGE_FILE_MISSING";
  if (error === "Roboflow returned no result") return "ROBOFLOW_NO_RESULT";
  return "WORKFLOW_CALL_FAILED";
}

function cleanPythonError(error?: string) {
  if (error === "Missing Roboflow API key") return "Missing Roboflow API key";
  if (error === "Missing workflow ID") return "Missing workflow ID";
  if (error === "Python dependency missing") return "Python dependency missing";
  if (error === "Image file missing") return "Image file missing";
  if (error === "Roboflow returned no result") return "Roboflow returned no result";
  return "Workflow call failed";
}
