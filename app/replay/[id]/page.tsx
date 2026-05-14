import AxisReplayClient from "@/components/AxisReplayClient"

type Props = {
  params: Promise<{
    id: string
  }>
}

export default async function ReplayPage({
  params,
}: Props) {
  const { id } = await params

  return (
    <main className="min-h-screen bg-black px-5 py-8 text-white">
      <div className="mx-auto max-w-xl">
        <div className="mb-10">
          <p className="mb-4 text-[12px] uppercase tracking-[0.45em] text-zinc-600">
            Axis Replay
          </p>

          <h1 className="text-[74px] font-black leading-[0.88] tracking-[-0.08em]">
            AXIS
            <br />
            REPLAY
          </h1>

          <p className="mt-8 text-2xl text-zinc-400">
            Axis remembers how you play.
          </p>
        </div>

        <AxisReplayClient playbackId={id} />
      </div>
    </main>
  )
}