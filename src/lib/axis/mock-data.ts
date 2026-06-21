import type { AxisActivityItem, AxisOutput, AxisProjectStatus, AxisRunStep } from "./types";

export const axisSuggestedCommands = [
  "Summarize this file",
  "Break down this film",
  "Create a training plan",
  "Generate a report",
  "Transcribe this audio",
  "Analyze this image",
  "Clip this video",
  "Automate this task",
];

export const axisRecentOutputs: AxisOutput[] = [
  {
    id: "output-text-1",
    title: "Tournament prep note",
    type: "text",
    status: "ready",
    createdAt: "2026-06-21T09:14:00.000Z",
    summary: "A compact prep read with what is known, what needs to lock, and the next move.",
    sourceLabel: "Command",
  },
  {
    id: "output-video-1",
    title: "Film breakdown queue",
    type: "video",
    status: "processing",
    createdAt: "2026-06-21T09:02:00.000Z",
    summary: "Clip is being shaped into suggested moments and review notes.",
    sourceLabel: "Video",
  },
  {
    id: "output-report-1",
    title: "Player development report",
    type: "report",
    status: "ready",
    createdAt: "2026-06-20T21:41:00.000Z",
    summary: "A readable output built from the current thread and selected notes.",
    sourceLabel: "Report",
  },
  {
    id: "output-image-1",
    title: "Image analysis result",
    type: "image",
    status: "ready",
    createdAt: "2026-06-20T18:26:00.000Z",
    summary: "Suggested visual observations prepared for review.",
    sourceLabel: "Image",
  },
  {
    id: "output-clip-1",
    title: "Pressure sequence clip",
    type: "clip",
    status: "ready",
    createdAt: "2026-06-20T16:07:00.000Z",
    summary: "A short clip output with a title, summary, and next review action.",
    sourceLabel: "Clip",
  },
  {
    id: "output-audio-1",
    title: "Voice note transcript",
    type: "audio",
    status: "ready",
    createdAt: "2026-06-19T22:18:00.000Z",
    summary: "Speech converted into a clean note and suggested follow-up.",
    sourceLabel: "Audio",
  },
  {
    id: "output-automation-1",
    title: "Weekly recap automation",
    type: "automation",
    status: "failed",
    createdAt: "2026-06-19T15:52:00.000Z",
    summary: "Automation needs one missing input before it can run again.",
    sourceLabel: "Automation",
  },
  {
    id: "output-file-1",
    title: "Uploaded scouting notes",
    type: "file",
    status: "ready",
    createdAt: "2026-06-18T12:30:00.000Z",
    summary: "File output prepared for summary, extraction, or report generation.",
    sourceLabel: "File",
  },
];

export const axisRunSteps: AxisRunStep[] = [
  { id: "empty", label: "Waiting for command", status: "empty" },
  { id: "loading", label: "Reading input", status: "loading" },
  { id: "processing", label: "Routing capability", status: "processing" },
  { id: "ready", label: "Output ready", status: "ready" },
];

export const axisActivityItems: AxisActivityItem[] = [
  {
    id: "activity-1",
    label: "Video output prepared",
    detail: "Clip queue is processing into reviewable moments.",
    status: "processing",
  },
  {
    id: "activity-2",
    label: "Report output ready",
    detail: "Development report is available in Recent Outputs.",
    status: "ready",
  },
  {
    id: "activity-3",
    label: "Automation needs input",
    detail: "Weekly recap is waiting for one missing source.",
    status: "failed",
  },
];

export const axisProjectStatus: AxisProjectStatus = {
  activeProject: "Current workspace",
  memoryState: "ready",
  queuedRuns: 2,
  storageState: "ready",
};
