import type { AxisAgent, AxisBuildOrderItem, AxisBuildScreen } from "./types";

export const axisBuildAgents: AxisAgent[] = [
  {
    id: 1,
    name: "Axis Router Agent",
    purpose: "Understands the request and routes it to the right agent.",
    status: "Static UI first.",
    futureWiring: "/api/axis/run router.",
    accent: "purple",
  },
  {
    id: 2,
    name: "Axis LLM Orchestrator Agent",
    purpose: "Chooses the best LLM, prompt strategy, context, and verification for each task.",
    status: "Static UI first.",
    futureWiring: "model orchestration layer.",
    accent: "gold",
  },
  {
    id: 3,
    name: "Media Intake Agent",
    purpose: "Handles uploads, captures, and turns media into Axis objects.",
    status: "Static UI first.",
    futureWiring: "upload, Cloudflare/Mux, Supabase storage.",
    accent: "blue",
  },
  {
    id: 4,
    name: "Voice Agent",
    purpose: "Listens in real time and turns speech into structured Axis data.",
    status: "Static UI first.",
    futureWiring: "mic, transcription, voice notes.",
    accent: "green",
  },
  {
    id: 5,
    name: "Vision Agent",
    purpose: "Detects players, ball, objects, court areas, body positions, and more.",
    status: "Static UI first.",
    futureWiring: "vision/cv pipeline.",
    accent: "orange",
  },
  {
    id: 6,
    name: "Video Understanding Agent",
    purpose: "Lets the user chat with video, find moments, patterns, and answers.",
    status: "Static UI first.",
    futureWiring: "video analysis, clips, summaries.",
    accent: "cyan",
  },
  {
    id: 7,
    name: "Session Memory Agent",
    purpose: "Stores challenge, constraint, reality, result, and next challenge.",
    status: "Static UI first.",
    futureWiring: "Supabase memory/session tables.",
    accent: "purple",
  },
  {
    id: 8,
    name: "Report Agent",
    purpose: "Turns evidence into player, parent, coach, and team reports.",
    status: "Static UI first.",
    futureWiring: "report generation, PDF/export, send/share.",
    accent: "gold",
  },
  {
    id: 9,
    name: "Follow-Up / Sales Agent",
    purpose: "Turns proof into action: updates, bookings, next steps, parent follow-up.",
    status: "Static UI first.",
    futureWiring: "messages, automations, reminders, booking flows.",
    accent: "green",
  },
];

export const axisBuildScreens: AxisBuildScreen[] = [
  {
    id: "home",
    title: "Home Screen",
    items: ["AXIS 9 identity", "New Session button", "Ask Axis button", "9 agent grid", "bottom navigation"],
  },
  {
    id: "sessions",
    title: "Sessions Screen",
    items: ["session list", "today / week / month filters", "processing and complete states"],
  },
  {
    id: "session-detail",
    title: "Session Detail Screen",
    items: ["video thumbnail", "summary", "clips", "notes", "stats", "challenge", "constraint", "result", "next challenge"],
  },
  {
    id: "ask-axis",
    title: "Ask Axis Screen",
    items: ["chat with video/session", "clip reference", "answer card", "next challenge", "mic input"],
  },
  {
    id: "player-profile",
    title: "Player Profile Screen",
    items: ["player image", "sessions", "challenges", "targets hit", "personal bests", "strengths", "opportunities"],
  },
  {
    id: "report",
    title: "Report Screen",
    items: ["player report", "grade", "summary", "strengths", "focus areas", "next challenge", "clips", "send to parent", "download PDF"],
  },
  {
    id: "how-axis-works",
    title: "How Axis Works Section",
    items: ["Capture", "Axis Agents", "Memory", "Proof", "Action"],
  },
];

export const axisBuildOrder: AxisBuildOrderItem[] = [
  { id: 1, title: "Blank /axis shell" },
  { id: 2, title: "/axis/build-map page" },
  { id: 3, title: "Static Axis 9 agent cards" },
  { id: 4, title: "Static mobile screen references" },
  { id: 5, title: "New Session button" },
  { id: 6, title: "Ask Axis input" },
  { id: 7, title: "Session object type" },
  { id: 8, title: "Player object type" },
  { id: 9, title: "AxisOutput object type" },
  { id: 10, title: "Media intake upload" },
  { id: 11, title: "Session detail page" },
  { id: 12, title: "Ask Axis chat page" },
  { id: 13, title: "Player profile page" },
  { id: 14, title: "Report page" },
  { id: 15, title: "Memory persistence" },
  { id: 16, title: "Report export/send" },
  { id: 17, title: "Follow-up automation" },
];
