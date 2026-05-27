import { RfTestSurface } from "@/components/axis-continuity/RfTestSurface"

export default function RfTestPage() {
  const roboflowConfigured = Boolean(process.env.ROBOFLOW_API_KEY && process.env.ROBOFLOW_WORKSPACE && process.env.ROBOFLOW_PROJECT)

  return <RfTestSurface roboflowConfigured={roboflowConfigured} />
}
