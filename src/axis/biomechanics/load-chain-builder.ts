import type { AxisPoseFrame, AxisPoseLandmark } from "../../lib/axis/axis-pose-detector";
import type { AxisChainNode, AxisMovementChain } from "./movement-chain-types";

const chainStorageKey = "axis-local-movement-chains";
const visibilityThreshold = 0.25;

type ChainSide = "left" | "right";

export function buildAxisLoadChain(
  pose: AxisPoseFrame | null,
  input: { sessionId: string; timestampMs: number },
): AxisMovementChain | null {
  if (!pose) return null;

  const landmarks = new Map(pose.landmarks.map((landmark) => [landmark.name, landmark]));
  const side = chooseChainSide(landmarks);
  const nodes = buildNodes(landmarks, side, input.timestampMs);
  if (nodes.length < 2) return null;

  const links = createLinks(nodes);
  const confidence = nodes.reduce((sum, node) => sum + node.confidence, 0) / nodes.length;

  return {
    confidence,
    id: `axis-load-chain-${crypto.randomUUID()}`,
    kind: "load_chain",
    links,
    nodes,
    reviewState: confidence >= 0.65 && nodes.length === 5 ? "ready" : nodes.length >= 3 ? "needs_review" : "uncertain",
    sessionId: input.sessionId,
    timestampMs: input.timestampMs,
  };
}

export function saveAxisMovementChain(chain: AxisMovementChain) {
  if (typeof window === "undefined") return false;

  try {
    const raw = window.localStorage.getItem(chainStorageKey);
    const current = raw ? JSON.parse(raw) : [];
    const chains = Array.isArray(current) ? current : [];
    window.localStorage.setItem(chainStorageKey, JSON.stringify([compactChain(chain), ...chains].slice(0, 100)));
    return true;
  } catch {
    try {
      window.localStorage.setItem(chainStorageKey, JSON.stringify([compactChain(chain)]));
      return true;
    } catch {
      return false;
    }
  }
}

function chooseChainSide(landmarks: Map<string, AxisPoseLandmark>): ChainSide {
  const leftScore = sideScore(landmarks, "left");
  const rightScore = sideScore(landmarks, "right");
  return leftScore >= rightScore ? "left" : "right";
}

function sideScore(landmarks: Map<string, AxisPoseLandmark>, side: ChainSide) {
  return [
    landmarks.get(`${side}_foot_index`) ?? landmarks.get(`${side}_heel`),
    landmarks.get(`${side}_ankle`),
    landmarks.get(`${side}_knee`),
    landmarks.get(`${side}_hip`),
    landmarks.get(`${side}_shoulder`),
  ].reduce((sum, landmark) => sum + confidence(landmark), 0);
}

function buildNodes(landmarks: Map<string, AxisPoseLandmark>, side: ChainSide, timestampMs: number): AxisChainNode[] {
  const foot = landmarks.get(`${side}_foot_index`) ?? landmarks.get(`${side}_heel`);
  const ankle = landmarks.get(`${side}_ankle`);
  const knee = landmarks.get(`${side}_knee`);
  const hip = landmarks.get(`${side}_hip`);
  const trunk = trunkPoint(landmarks);

  const chainNodes: Array<AxisChainNode | null> = [
    toNode("foot", "Foot", side, foot, timestampMs),
    toNode("ankle", "Ankle", side, ankle, timestampMs),
    toNode("knee", "Knee", side, knee, timestampMs),
    toNode("hip", "Hip", side, hip, timestampMs),
    trunk ? {
      confidence: trunk.confidence,
      id: `axis-chain-node-trunk-${timestampMs}`,
      kind: "trunk" as const,
      label: "Trunk",
      side: "center" as const,
      x: trunk.x,
      y: trunk.y,
    } : null,
  ];

  return chainNodes.filter((node): node is AxisChainNode => Boolean(node));
}

function toNode(
  kind: AxisChainNode["kind"],
  label: string,
  side: ChainSide,
  landmark: AxisPoseLandmark | undefined,
  timestampMs: number,
): AxisChainNode | null {
  if (!visible(landmark)) return null;
  return {
    confidence: confidence(landmark),
    id: `axis-chain-node-${side}-${kind}-${timestampMs}`,
    kind,
    label,
    side,
    x: clamp01(landmark.x),
    y: clamp01(landmark.y),
  };
}

function trunkPoint(landmarks: Map<string, AxisPoseLandmark>) {
  const visibleLandmarks = [
    landmarks.get("left_shoulder"),
    landmarks.get("right_shoulder"),
    landmarks.get("left_hip"),
    landmarks.get("right_hip"),
  ].filter(visible);
  if (visibleLandmarks.length < 2) return null;

  return {
    confidence: visibleLandmarks.reduce((sum, landmark) => sum + confidence(landmark), 0) / visibleLandmarks.length,
    x: visibleLandmarks.reduce((sum, landmark) => sum + landmark.x, 0) / visibleLandmarks.length,
    y: visibleLandmarks.reduce((sum, landmark) => sum + landmark.y, 0) / visibleLandmarks.length,
  };
}

function createLinks(nodes: AxisChainNode[]) {
  const sequence = ["foot", "ankle", "knee", "hip", "trunk"];
  const nodeByKind = new Map(nodes.map((node) => [node.kind, node]));

  return sequence.slice(0, -1).flatMap((fromKind, index) => {
    const from = nodeByKind.get(fromKind as AxisChainNode["kind"]);
    const to = nodeByKind.get(sequence[index + 1] as AxisChainNode["kind"]);
    if (!from || !to) return [];
    const confidence = Math.min(from.confidence, to.confidence);
    return [{
      confidence,
      fromNodeId: from.id,
      id: `axis-chain-link-${from.kind}-${to.kind}-${from.id.split("-").at(-1)}`,
      state: confidence >= 0.55 ? "ready" as const : "weak" as const,
      toNodeId: to.id,
    }];
  });
}

function compactChain(chain: AxisMovementChain): AxisMovementChain {
  return {
    confidence: chain.confidence,
    id: chain.id,
    kind: chain.kind,
    links: chain.links,
    nodes: chain.nodes,
    reviewState: chain.reviewState,
    sessionId: chain.sessionId,
    timestampMs: chain.timestampMs,
  };
}

function visible(landmark: AxisPoseLandmark | undefined): landmark is AxisPoseLandmark {
  return Boolean(landmark && Number.isFinite(landmark.x) && Number.isFinite(landmark.y) && confidence(landmark) > visibilityThreshold);
}

function confidence(landmark: AxisPoseLandmark | undefined) {
  return typeof landmark?.visibility === "number" ? landmark.visibility : landmark ? 0.75 : 0;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}
