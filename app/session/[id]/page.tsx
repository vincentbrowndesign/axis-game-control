import AxisReplayClient from "@/components/AxisReplayClient"

type Props = {
  params: Promise<{
    id: string
  }>
}

export default async function SessionPage({ params }: Props) {
  const { id } = await params

  return (
    <main className="min-h-screen bg-black text-white">
      <AxisReplayClient
        playbackId={id}
        className="mx-auto w-full max-w-4xl"
      />
    </main>
  )
}