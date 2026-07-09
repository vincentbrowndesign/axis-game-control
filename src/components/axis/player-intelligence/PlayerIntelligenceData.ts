export type OperatingSection = {
  title: string;
  items: string[];
};

export const operatingSections: OperatingSection[] = [
  {
    title: "Company",
    items: ["Trophy Labs", "Axis", "Player Intelligence", "Offers + Revenue", "Build Decision Log"],
  },
  {
    title: "Product",
    items: [
      "Trophy Labs Player Intelligence Session",
      "Axis Capture Kit",
      "Axis Baseline Session",
      "Trophy Labs Player Intelligence Report",
      "Axis Player Intelligence Report",
      "Mobile Player Intelligence Lab",
      "Team Testing Day",
      "Player Intelligence Session Pricing",
    ],
  },
  {
    title: "Operating",
    items: [
      "Axis Session Checklist",
      "Axis Capture Protocol",
      "Axis Report Template",
      "Parent Permission",
      "Privacy Rules",
      "Minor Athlete Data",
      "Public Content Rules",
    ],
  },
  {
    title: "Data",
    items: ["Player Graph", "Session Graph", "Evidence Vault", "Proof Clips", "Development Plan", "Next Objective"],
  },
  {
    title: "Capture Kit",
    items: [
      "Tripod Camera",
      "iPad Capture Station",
      "Capture Checklist",
      "Proof Clip Folder",
      "Report Draft",
      "Parent Permission",
      "Private Backup",
    ],
  },
];

export const currentPriorities = [
  "Launch Trophy Labs Player Intelligence Sessions",
  "Build the Axis Capture Kit",
  "Create repeatable session reports",
  "Turn every session into player evidence",
  "Build the data asset behind the company",
  "Complete the First 10 Player Intelligence Sessions",
];

export const sprintTasks = [
  "Create parent permission form",
  "Create player intake form",
  "Create session checklist",
  "Create proof clip tracker",
  "Create report draft workflow",
  "Create next objective field",
  "Create follow-up offer field",
  "Create first 10 sessions tracker",
];

export const captureChecklist = [
  "Tripod stable",
  "Camera locked",
  "Battery charged",
  "Storage available",
  "Lens clean",
  "Full body visible",
  "Feet visible",
  "Ball visible",
  "Defender visible if needed",
  "Court space visible",
  "Test clip recorded",
];

export const firstTenRows = Array.from({ length: 10 }, (_, index) => ({
  number: index + 1,
  player: "",
  date: "",
  paid: false,
  sessionType: "",
  mainGoal: "",
  proofClips: "",
  reportSent: false,
  nextObjective: "",
  followUpOffered: false,
  followUpSold: false,
  lesson: "",
}));
