export type AxisCapabilityStatus = "planned" | "active" | "testing" | "paused";

export type AxisCapabilityCategory =
  | "Vision"
  | "Audio / Voice"
  | "LLM / Reasoning"
  | "Data / Storage"
  | "Charts / Reports"
  | "Automation"
  | "Content"
  | "Nutrition / Body"
  | "Time / Location"
  | "Documents / Export";

export type AxisCapability = {
  acceptance_test: string;
  category: AxisCapabilityCategory;
  datasets_created: string[];
  description: string;
  first_page: string;
  id: string;
  inputs: string[];
  name: string;
  outputs: string[];
  possible_providers: string[];
  status: AxisCapabilityStatus;
};

export type AxisDataset = {
  description: string;
  id: string;
  name: string;
  status: "seed" | "active";
};

export type AxisLoop = {
  acceptance_test: string;
  capability: string;
  dataset: string;
  id: string;
  input: string;
  name: string;
  output: string;
  provider: string;
  result: string;
  review: string;
  status: AxisCapabilityStatus;
};

export type AxisProvider = {
  description: string;
  id: string;
  name: string;
  status: "available" | "planned";
  type: string;
};

export const axisCapabilityCategories: AxisCapabilityCategory[] = [
  "Vision",
  "Audio / Voice",
  "LLM / Reasoning",
  "Data / Storage",
  "Charts / Reports",
  "Automation",
  "Content",
  "Nutrition / Body",
  "Time / Location",
  "Documents / Export",
];

export const axisCapabilities: AxisCapability[] = [
  {
    acceptance_test: "Opening /axis/vision starts and stops the rear camera on iPhone Safari.",
    category: "Vision",
    datasets_created: ["sessions"],
    description: "Open a mobile camera feed so Axis can capture session context without analysis.",
    first_page: "/axis/vision",
    id: "camera-capture",
    inputs: ["rear camera"],
    name: "Camera Capture",
    outputs: ["mobile camera page"],
    possible_providers: ["browser-camera"],
    status: "active",
  },
  {
    acceptance_test: "A typed note can become a local session memory draft.",
    category: "Data / Storage",
    datasets_created: ["sessions"],
    description: "Save a basic session draft that can later become memory.",
    first_page: "/axis",
    id: "session-draft",
    inputs: ["typed note", "tap event"],
    name: "Session Draft",
    outputs: ["session draft"],
    possible_providers: ["local-storage"],
    status: "active",
  },
  {
    acceptance_test: "Voice capture remains hidden until a real loop is active.",
    category: "Audio / Voice",
    datasets_created: ["sessions"],
    description: "Future voice input for creating session memory.",
    first_page: "/axis/space",
    id: "voice-capture",
    inputs: ["microphone"],
    name: "Voice Capture",
    outputs: ["transcript draft"],
    possible_providers: ["browser-microphone"],
    status: "planned",
  },
  {
    acceptance_test: "Reasoning providers are listed but not connected.",
    category: "LLM / Reasoning",
    datasets_created: ["assets"],
    description: "Future reasoning over saved session memory.",
    first_page: "/axis/space",
    id: "memory-reasoning",
    inputs: ["session draft"],
    name: "Memory Reasoning",
    outputs: ["structured memory"],
    possible_providers: ["openai", "anthropic", "local-rules"],
    status: "planned",
  },
  {
    acceptance_test: "Reports remain map-only until a report loop is active.",
    category: "Charts / Reports",
    datasets_created: ["assets"],
    description: "Future charts and reports generated from reviewed memory.",
    first_page: "/axis/space",
    id: "memory-reports",
    inputs: ["sessions", "assets"],
    name: "Memory Reports",
    outputs: ["review report"],
    possible_providers: ["browser-render"],
    status: "planned",
  },
  {
    acceptance_test: "Automation remains map-only until a loop is active.",
    category: "Automation",
    datasets_created: ["loops"],
    description: "Future background actions that move reviewed records through Axis.",
    first_page: "/axis/space",
    id: "review-automation",
    inputs: ["reviewed memory"],
    name: "Review Automation",
    outputs: ["next action"],
    possible_providers: ["scheduled-job"],
    status: "planned",
  },
  {
    acceptance_test: "Content tools remain map-only until a loop is active.",
    category: "Content",
    datasets_created: ["assets"],
    description: "Future content output from saved Axis memory.",
    first_page: "/axis/space",
    id: "content-builder",
    inputs: ["assets"],
    name: "Content Builder",
    outputs: ["draft content"],
    possible_providers: ["browser-render", "llm-provider"],
    status: "planned",
  },
  {
    acceptance_test: "Body and nutrition data remain map-only.",
    category: "Nutrition / Body",
    datasets_created: ["assets"],
    description: "Future body context that may support training memory.",
    first_page: "/axis/space",
    id: "body-context",
    inputs: ["manual body note"],
    name: "Body Context",
    outputs: ["body note"],
    possible_providers: ["manual-entry"],
    status: "planned",
  },
  {
    acceptance_test: "Time and location data remain map-only.",
    category: "Time / Location",
    datasets_created: ["sessions"],
    description: "Future session time and location context.",
    first_page: "/axis/space",
    id: "session-context",
    inputs: ["time", "location"],
    name: "Session Context",
    outputs: ["session context"],
    possible_providers: ["browser-time", "manual-location"],
    status: "planned",
  },
  {
    acceptance_test: "Exports remain map-only until an export loop is active.",
    category: "Documents / Export",
    datasets_created: ["assets"],
    description: "Future document and export capability for reviewed memory.",
    first_page: "/axis/space",
    id: "memory-export",
    inputs: ["assets", "sessions"],
    name: "Memory Export",
    outputs: ["downloadable document"],
    possible_providers: ["browser-download"],
    status: "planned",
  },
];

export const axisDatasets: AxisDataset[] = [
  { description: "People connected to saved Axis work.", id: "players", name: "Players", status: "seed" },
  { description: "Session drafts and saved session records.", id: "sessions", name: "Sessions", status: "active" },
  { description: "Future reviewed camera events.", id: "vision_events", name: "Vision Events", status: "seed" },
  { description: "Future reviewed shot attempts.", id: "shot_attempts", name: "Shot Attempts", status: "seed" },
  { description: "Future reviewed drill outcomes.", id: "drill_results", name: "Drill Results", status: "seed" },
  { description: "Future saved video or image clips.", id: "clips", name: "Clips", status: "seed" },
  { description: "Capability records in Axis Space.", id: "capabilities", name: "Capabilities", status: "seed" },
  { description: "Provider records in Axis Space.", id: "providers", name: "Providers", status: "seed" },
  { description: "Loop records in Axis Space.", id: "loops", name: "Loops", status: "seed" },
  { description: "Future reviewed outputs and exports.", id: "assets", name: "Assets", status: "seed" },
];

export const axisProviders: AxisProvider[] = [
  {
    description: "Native browser camera access. No external API key.",
    id: "browser-camera",
    name: "Browser Camera",
    status: "available",
    type: "browser",
  },
  {
    description: "Local browser storage for lightweight drafts.",
    id: "local-storage",
    name: "Local Storage",
    status: "available",
    type: "browser",
  },
  {
    description: "Placeholder for future reasoning providers.",
    id: "llm-provider",
    name: "Reasoning Provider",
    status: "planned",
    type: "external",
  },
  {
    description: "Placeholder for future file/document output.",
    id: "browser-download",
    name: "Browser Download",
    status: "planned",
    type: "browser",
  },
];

export const axisLoops: AxisLoop[] = [
  {
    acceptance_test: "Opening /axis/vision only runs the Vision Capture Loop.",
    capability: "camera capture",
    dataset: "session draft",
    id: "vision-capture-loop",
    input: "rear camera",
    name: "Vision Capture Loop",
    output: "mobile camera page",
    provider: "browser camera",
    result: "live video feed",
    review: "Start/Stop works on iPhone Safari",
    status: "active",
  },
];
