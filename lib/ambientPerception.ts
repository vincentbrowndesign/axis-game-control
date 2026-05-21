import type { AxisReplayAnchor } from "@/lib/axisEventModel"
import type { AxisMemoryScoreState, AxisMemoryTeam } from "@/lib/axisMemoryObject"
import type { ContinuityAssistSample } from "@/lib/continuityAssistance"

type AmbientPerceptionInput = {
  sessionTime: number
  gameClock: string | null
  scoreBefore: AxisMemoryScoreState | null
  scoreAfter: AxisMemoryScoreState | null
  possession: AxisMemoryTeam | null
  replayAnchor: AxisReplayAnchor | null
  continuity: ContinuityAssistSample | null
}

function scoreDelta(
  before: AxisMemoryScoreState | null,
  after: AxisMemoryScoreState | null
) {
  if (!before || !after) {
    return {
      home: 0,
      away: 0,
      total: 0,
    }
  }

  const home = after.home - before.home
  const away = after.away - before.away

  return {
    home,
    away,
    total: home + away,
  }
}

function courtZoneFromRegion(region: ContinuityAssistSample["primaryRegion"]) {
  if (!region) return null

  const centerX = region.x + region.width / 2
  const centerY = region.y + region.height / 2
  const horizontal = centerX < 33 ? "left" : centerX > 67 ? "right" : "middle"
  const vertical = centerY < 35 ? "backcourt" : centerY > 70 ? "paint" : "arc"

  return `${horizontal}_${vertical}`
}

export function buildAmbientPerceptionSnapshot({
  sessionTime,
  gameClock,
  scoreBefore,
  scoreAfter,
  possession,
  replayAnchor,
  continuity,
}: AmbientPerceptionInput) {
  const delta = scoreDelta(scoreBefore, scoreAfter)
  const scoreChanged = delta.total !== 0
  const primaryRegion = continuity?.primaryRegion ?? null
  const courtZone = courtZoneFromRegion(primaryRegion)
  const confidence = continuity
    ? Math.min(
        0.82,
        0.38 +
          continuity.kineticDensity * 0.18 +
          continuity.pressure * 0.16 +
          continuity.motionEnergy * 0.1
      )
    : 0.34

  return {
    cvMetadata: {
      source: "ambient_perception",
      mode: "assistive",
      confidence,
      scoreboard: {
        home: scoreAfter?.home ?? scoreBefore?.home ?? null,
        away: scoreAfter?.away ?? scoreBefore?.away ?? null,
        verification: scoreChanged ? "score_change_detected" : "operator_synced",
      },
      gameClock: {
        value: gameClock,
        sessionTime,
        verification: "session_clock",
      },
      scoreChange: {
        detected: scoreChanged,
        delta,
      },
      possessionHint: possession,
      replayTimestamp: replayAnchor
        ? {
            sessionTime: replayAnchor.sessionTime,
            clipStart: replayAnchor.clipStart,
            clipEnd: replayAnchor.clipEnd,
            verification: "anchor_ready",
          }
        : null,
      playerLocalization: {
        status: primaryRegion ? "motion_region_prepared" : "prepared",
        primaryRegion,
      },
    },
    spatialMetadata: {
      source: "ambient_perception",
      courtZone,
      primaryRegion,
    },
    movementMetadata: continuity
      ? {
          source: "ambient_perception",
          attentionState: continuity.attentionState,
          pressure: continuity.pressure,
          kineticDensity: continuity.kineticDensity,
          motionEnergy: continuity.motionEnergy,
          acceleration: continuity.acceleration,
          movementOrigin: continuity.movementOrigin,
        }
      : {
          source: "ambient_perception",
          attentionState: "IDLE",
          pressure: null,
          kineticDensity: null,
          motionEnergy: null,
          acceleration: null,
          movementOrigin: null,
        },
  }
}
