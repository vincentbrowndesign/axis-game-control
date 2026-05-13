import * as posedetection from "@tensorflow-models/pose-detection"
import "@tensorflow/tfjs-backend-webgl"

let detector: posedetection.PoseDetector | null = null

export async function getDetector() {
  if (detector) return detector

  detector = await posedetection.createDetector(
    posedetection.SupportedModels.MoveNet,
    {
      modelType:
        posedetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
    }
  )

  return detector
}