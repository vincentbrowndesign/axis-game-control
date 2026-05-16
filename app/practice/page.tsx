import { redirect } from "next/navigation"
import { getCalibrationMissions } from "@/lib/missions/getCalibrationMissions"

export default function PracticePage() {
  const firstPractice = getCalibrationMissions()[0]

  redirect(firstPractice ? `/?warmup=${firstPractice.id}` : "/")
}
