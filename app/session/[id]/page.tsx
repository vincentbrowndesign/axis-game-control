import AxisReplayClient from "@/components/AxisReplayClient"

type PageProps = {
  params: Promise<{
    id: string
  }>
}

export default async function SessionPage({ params }: PageProps) {
  const { id } = await params

  return <AxisReplayClient sessionId={id} />
}