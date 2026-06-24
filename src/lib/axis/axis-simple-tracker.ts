import type { AxisDetectionKind, AxisLiveDetection, AxisVisionTrack } from "./axis-vision-types";

type TrackerOptions = {
  personIouThreshold?: number;
  ballIouThreshold?: number;
  maxMissedFrames?: number;
};

type MutableTrack = AxisVisionTrack;

export function calculateIoU(
  a: [number, number, number, number],
  b: [number, number, number, number],
) {
  const [ax, ay, aw, ah] = a;
  const [bx, by, bw, bh] = b;
  const left = Math.max(ax, bx);
  const top = Math.max(ay, by);
  const right = Math.min(ax + aw, bx + bw);
  const bottom = Math.min(ay + ah, by + bh);
  const intersectionWidth = Math.max(0, right - left);
  const intersectionHeight = Math.max(0, bottom - top);
  const intersectionArea = intersectionWidth * intersectionHeight;
  const unionArea = aw * ah + bw * bh - intersectionArea;

  return unionArea > 0 ? intersectionArea / unionArea : 0;
}

export function createAxisTracker(options: TrackerOptions = {}) {
  const personIouThreshold = options.personIouThreshold ?? 0.25;
  const ballIouThreshold = options.ballIouThreshold ?? 0.15;
  const maxMissedFrames = options.maxMissedFrames ?? 10;
  const tracks: MutableTrack[] = [];
  const counters: Record<AxisDetectionKind, number> = {
    ball: 0,
    other: 0,
    person: 0,
  };

  function createTrack(detection: AxisLiveDetection, timestamp: number): MutableTrack {
    counters[detection.kind] += 1;
    const prefix = detection.kind === "ball" ? "B" : detection.kind === "person" ? "P" : "O";

    return {
      bbox: detection.bbox,
      classId: detection.classId,
      className: detection.className,
      firstSeenAt: timestamp,
      kind: detection.kind,
      label: detection.label,
      lastSeenAt: timestamp,
      missedFrames: 0,
      score: detection.score,
      seenFrames: 1,
      status: "active",
      trackId: `${prefix}${counters[detection.kind]}`,
      mappedType: detection.mappedType,
    };
  }

  function thresholdFor(kind: AxisDetectionKind) {
    return kind === "ball" ? ballIouThreshold : personIouThreshold;
  }

  return {
    reset() {
      tracks.splice(0, tracks.length);
      counters.ball = 0;
      counters.other = 0;
      counters.person = 0;
    },

    update(detections: AxisLiveDetection[], timestamp: number) {
      const activeTracks = tracks.filter((track) => track.status === "active");
      const matchedTrackIndexes = new Set<number>();
      const matchedDetectionIndexes = new Set<number>();

      detections.forEach((detection, detectionIndex) => {
        let bestTrackIndex = -1;
        let bestScore = 0;

        activeTracks.forEach((track) => {
          const trackIndex = tracks.indexOf(track);
          if (matchedTrackIndexes.has(trackIndex) || track.kind !== detection.kind) return;

          const iou = calculateIoU(track.bbox, detection.bbox);
          const distanceScore = centerDistanceScore(track.bbox, detection.bbox);
          const score = Math.max(iou, distanceScore);
          if (score > bestScore) {
            bestScore = score;
            bestTrackIndex = trackIndex;
          }
        });

        if (bestTrackIndex >= 0 && bestScore >= thresholdFor(detection.kind)) {
          const track = tracks[bestTrackIndex];
          track.bbox = detection.bbox;
          track.classId = detection.classId;
          track.className = detection.className;
          track.label = detection.label;
          track.lastSeenAt = timestamp;
          track.mappedType = detection.mappedType;
          track.missedFrames = 0;
          track.score = detection.score;
          track.seenFrames += 1;
          track.status = "active";
          matchedTrackIndexes.add(bestTrackIndex);
          matchedDetectionIndexes.add(detectionIndex);
        }
      });

      activeTracks.forEach((track) => {
        const trackIndex = tracks.indexOf(track);
        if (matchedTrackIndexes.has(trackIndex)) return;

        track.missedFrames += 1;
        track.lastSeenAt = timestamp;
        if (track.missedFrames > maxMissedFrames) track.status = "lost";
      });

      detections.forEach((detection, detectionIndex) => {
        if (!matchedDetectionIndexes.has(detectionIndex)) {
          tracks.push(createTrack(detection, timestamp));
        }
      });

      return tracks
        .filter((track) => track.status === "active")
        .map((track) => ({ ...track }));
    },
  };
}

function centerDistanceScore(
  a: [number, number, number, number],
  b: [number, number, number, number],
) {
  const [ax, ay, aw, ah] = a;
  const [bx, by, bw, bh] = b;
  const acx = ax + aw / 2;
  const acy = ay + ah / 2;
  const bcx = bx + bw / 2;
  const bcy = by + bh / 2;
  const distance = Math.hypot(acx - bcx, acy - bcy);
  const allowed = Math.max(80, Math.min(260, Math.max(aw, ah, bw, bh) * 0.46));
  return Math.max(0, 1 - distance / allowed);
}
