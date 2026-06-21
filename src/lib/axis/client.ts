export const AXIS_UI_V2_ENABLED = process.env.NEXT_PUBLIC_AXIS_UI_V2 === "true";

export type AxisRunPayload = {
  cameraCapture?: File;
  currentProject?: string;
  inputText: string;
  mode: "type" | "voice" | "upload" | "camera";
  uploadedFile?: File;
  userId?: string;
  voiceTranscript?: string;
};

export async function sendAxisRun(_payload: AxisRunPayload) {
  throw new Error("Axis run wiring is not active yet. Static UI ships first.");
}
