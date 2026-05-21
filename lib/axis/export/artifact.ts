import { buildAxisContextPackage, type AxisContextPackageInput } from "@/lib/axis/contextPackage"
import { machineObservationsFromMemory, observationClosure } from "@/lib/axis/perception/machineObservations"
import { computeExportSignalStack, type AxisExportSignalStack, type AxisExportTiming } from "@/lib/axis/export/signals"
import type { AxisMemoryObject, AxisPlayerStatLine, AxisStaticOutputs } from "@/lib/axis/types"

export type AxisExportTier =
  | "box_score"
  | "continuity_report"
  | "memory_clusters"
  | "replay_evidence"
  | "machine_observations"
  | "player_constellations"

export type AxisMemoryArtifactSection = {
  tier: AxisExportTier
  title: string
  lines: string[]
  memoryIds: string[]
}

export type AxisSessionMemoryArtifact = {
  id: string
  createdAt: string
  timing: AxisExportTiming
  title: string
  gravity: number
  exportReason: string
  signalStack: AxisExportSignalStack
  sections: AxisMemoryArtifactSection[]
}

export type AxisArtifactBuildResult =
  | {
      exported: true
      artifact: AxisSessionMemoryArtifact
    }
  | {
      exported: false
      signalStack: AxisExportSignalStack
    }

export function buildSignalGatedSessionArtifact(
  input: AxisContextPackageInput,
  timing: AxisExportTiming = "coach_request",
): AxisArtifactBuildResult {
  const context = buildAxisContextPackage(input)
  const signalStack = computeExportSignalStack(context, timing)

  if (!signalStack.shouldExport) {
    return {
      exported: false,
      signalStack,
    }
  }

  const memories = context.recentMemory.lastEvents
  const sections = [
    boxScoreSection(context.staticAnalytics),
    continuityReportSection(memories, signalStack),
    memoryClustersSection(memories),
    replayEvidenceSection(memories),
    machineObservationsSection(memories),
    playerConstellationsSection(context.staticAnalytics.players, memories),
  ].filter((section) => section.lines.length)

  return {
    exported: true,
    artifact: {
      id: `artifact-${Date.now().toString(36)}`,
      createdAt: new Date().toISOString(),
      timing,
      title: artifactTitle(input.session.quarter, signalStack.reason),
      gravity: signalStack.gravity,
      exportReason: signalStack.reason,
      signalStack,
      sections,
    },
  }
}

function boxScoreSection(staticOutputs: AxisStaticOutputs): AxisMemoryArtifactSection {
  const lines = [
    `Score ${staticOutputs.score.home}-${staticOutputs.score.away}`,
    ...staticOutputs.players
      .filter((line) => line.points || line.rebounds || line.assists || line.turnovers || line.fouls)
      .slice(0, 6)
      .map(playerBoxLine),
  ]

  return {
    tier: "box_score",
    title: "Box score",
    lines,
    memoryIds: [],
  }
}

function continuityReportSection(memories: AxisMemoryObject[], signalStack: AxisExportSignalStack): AxisMemoryArtifactSection {
  const signalLines = signalStack.signals
    .filter((signal) => signal.score >= 0.34 && signal.evidence.length)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((signal) => continuityLine(signal.evidence[0], signal.name))

  return {
    tier: "continuity_report",
    title: "Continuity report",
    lines: unique(signalLines),
    memoryIds: memories.slice(0, 6).map((memory) => memory.id),
  }
}

function memoryClustersSection(memories: AxisMemoryObject[]): AxisMemoryArtifactSection {
  const clusters = [
    cluster("Turnover chains", memories, (memory) => hasAny(memory, ["turnover", "stop"]) || /\bturnover|TO|steal|pressure\b/i.test(memory.label)),
    cluster("Transition pressure", memories, (memory) => hasAny(memory, ["rebound", "stop"]) || /\bpush|outlet|transition|early\b/i.test(memory.label)),
    cluster("Collapse windows", memories, (memory) => /\bweak[- ]side|late help|no help|bad switch|collapse|close[- ]?out\b/i.test(memory.label)),
  ].filter((item) => item.lines.length)

  return {
    tier: "memory_clusters",
    title: clusters[0]?.title ?? "Memory clusters",
    lines: clusters.flatMap((item) => [item.title, ...item.lines]).slice(0, 9),
    memoryIds: clusters.flatMap((item) => item.memoryIds),
  }
}

function replayEvidenceSection(memories: AxisMemoryObject[]): AxisMemoryArtifactSection {
  const replay = memories
    .filter((memory) => memory.replayAnchor && memoryGravity(memory) >= 0.36)
    .slice(0, 5)

  return {
    tier: "replay_evidence",
    title: "Replay evidence",
    lines: replay.map((memory) => `${memory.timestamp} ${coachLine(memory.label)}`),
    memoryIds: replay.map((memory) => memory.id),
  }
}

function machineObservationsSection(memories: AxisMemoryObject[]): AxisMemoryArtifactSection {
  const observations = memories
    .flatMap((memory) =>
      machineObservationsFromMemory(memory).map((item) => ({
        memory,
        label: observationClosure(item.label, "", item.confidence),
      })),
    )
    .slice(0, 5)

  return {
    tier: "machine_observations",
    title: "Machine observations",
    lines: unique(observations.map((item) => item.label)),
    memoryIds: observations.map((item) => item.memory.id),
  }
}

function playerConstellationsSection(players: AxisPlayerStatLine[], memories: AxisMemoryObject[]): AxisMemoryArtifactSection {
  const lines = players
    .filter((player) => player.points || player.rebounds || player.assists || memories.some((memory) => memory.playerIds.includes(player.id)))
    .slice(0, 5)
    .map((player) => playerConstellation(player, memories))

  return {
    tier: "player_constellations",
    title: "Player constellations",
    lines,
    memoryIds: memories.filter((memory) => memory.playerIds.length).map((memory) => memory.id),
  }
}

function cluster(
  title: string,
  memories: AxisMemoryObject[],
  predicate: (memory: AxisMemoryObject) => boolean,
) {
  const matched = memories.filter(predicate).filter((memory) => memoryGravity(memory) >= 0.28).slice(0, 4)
  return {
    title,
    lines: matched.map((memory) => coachLine(memory.label)),
    memoryIds: matched.map((memory) => memory.id),
  }
}

function artifactTitle(quarter: string, reason: string) {
  return reason === "no high-gravity memory yet" ? `${quarter} memory artifact` : `${quarter} ${coachLine(reason)}`
}

function continuityLine(evidence: string, signalName: string) {
  if (signalName === "pressure_escalation") return `${coachLine(evidence)} carried pressure`
  if (signalName === "transition_burst") return `${coachLine(evidence)} opened transition`
  if (signalName === "repeated_breakdown") return `${coachLine(evidence)} repeated`
  if (signalName === "replay_gravity") return `${coachLine(evidence)} has replay weight`
  return coachLine(evidence)
}

function playerConstellation(player: AxisPlayerStatLine, memories: AxisMemoryObject[]) {
  const playerMemories = memories.filter((memory) => memory.playerIds.includes(player.id))
  const first = playerMemories[0]
  if (first?.tags.includes("rebound")) return `${player.label} stabilized transition pressure`
  if (first?.tags.includes("scoring")) return `${player.label} triggered early offense chains`
  if (first) return `${player.label} stayed tied to ${coachLine(first.label)}`
  return `${player.label} registered in the memory layer`
}

function playerBoxLine(player: AxisPlayerStatLine) {
  const parts = [
    player.points ? `${player.points} pts` : null,
    player.rebounds ? `${player.rebounds} reb` : null,
    player.assists ? `${player.assists} ast` : null,
    player.turnovers ? `${player.turnovers} tov` : null,
    player.fouls ? `${player.fouls} fouls` : null,
  ].filter(Boolean)

  return `${player.label}: ${parts.join(", ")}`
}

function memoryGravity(memory: AxisMemoryObject) {
  let gravity = 0.18
  if (memory.replayAnchor) gravity += 0.18
  if (hasAny(memory, ["turnover", "stop", "run", "replay"])) gravity += 0.2
  if (hasAny(memory, ["scoring", "rebound"])) gravity += 0.14
  if (/\bweak[- ]side|late help|bad switch|downhill|easy rim|corner 3|and-1\b/i.test(memory.label)) gravity += 0.2
  return Math.min(1, gravity)
}

function coachLine(label: string) {
  return label.replace(/\s+/g, " ").trim()
}

function hasAny(memory: AxisMemoryObject, tags: string[]) {
  return tags.some((tag) => memory.tags.includes(tag))
}

function unique(lines: string[]) {
  return Array.from(new Set(lines.filter(Boolean)))
}
