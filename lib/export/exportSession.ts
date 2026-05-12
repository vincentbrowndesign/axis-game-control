import { SessionEvent } from "../session/sessionTypes";

interface ExportSessionParams {
  blob: Blob;

  homeScore: number;
  awayScore: number;

  events: SessionEvent[];
}

export async function exportSession({
  blob,
  homeScore,
  awayScore,
  events,
}: ExportSessionParams) {
  const recordingUrl = URL.createObjectURL(blob);

  const a = document.createElement("a");

  a.href = recordingUrl;

  a.download = `axis-session-${Date.now()}.webm`;

  document.body.appendChild(a);

  a.click();

  document.body.removeChild(a);

  localStorage.setItem(
    "axis-last-session",
    JSON.stringify({
      homeScore,
      awayScore,
      events,
      savedAt: new Date().toISOString(),
    })
  );

  return recordingUrl;
}