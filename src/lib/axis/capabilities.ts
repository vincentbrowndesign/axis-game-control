import type { AxisCapability, AxisNavigationItem } from "./types";

export const axisNavigationItems: AxisNavigationItem[] = [
  { id: "home", label: "Home" },
  { id: "chat", label: "Chat" },
  { id: "voice", label: "Voice" },
  { id: "vision", label: "Vision" },
  { id: "files", label: "Files" },
  { id: "video", label: "Video" },
  { id: "images", label: "Images" },
  { id: "automations", label: "Automations" },
  { id: "reports", label: "Reports" },
  { id: "memory", label: "Memory" },
];

export const axisCapabilities: AxisCapability[] = [
  {
    id: "text",
    title: "Text",
    description: "Draft, reason, summarize, plan, and turn rough notes into usable outputs.",
    status: "connected",
  },
  {
    id: "voice",
    title: "Voice",
    description: "Capture spoken input and shape it into transcripts, notes, and outputs.",
    status: "ready",
  },
  {
    id: "vision",
    title: "Vision",
    description: "Read images and visual context as suggested observations.",
    status: "ready",
  },
  {
    id: "images",
    title: "Images",
    description: "Create, inspect, and transform image-based outputs.",
    status: "ready",
  },
  {
    id: "video",
    title: "Video",
    description: "Process clips, find moments, and prepare review-ready video outputs.",
    status: "ready",
  },
  {
    id: "automations",
    title: "Automations",
    description: "Run repeatable tasks and return status as Axis outputs.",
    status: "ready",
  },
  {
    id: "reports",
    title: "Reports",
    description: "Package findings, notes, and generated work into readable reports.",
    status: "ready",
  },
  {
    id: "more",
    title: "More",
    description: "Bring additional tools into the same command surface over time.",
    status: "coming_soon",
  },
];
