import { BehavioralTelemetryPlayer } from "@/components/axis-replay/BehavioralTelemetryPlayer"

type ReplayNativePageProps = {
  searchParams: Promise<{
    session?: string
  }>
}

export default async function ReplayNativePage({
  searchParams,
}: ReplayNativePageProps) {
  const params = await searchParams

  return <BehavioralTelemetryPlayer sessionId={params.session || null} />
}
