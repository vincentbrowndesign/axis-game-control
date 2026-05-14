import AxisReplayClient from "@/components/AxisReplayClient"

type Props = {
  params: Promise<{
    id: string
  }>
}

export default async function ReplayPage({ params }: Props) {
  const { id } = await params

  return <AxisReplayClient sessionId={id} />
}