import {
  getAxisSession,
} from "@/lib/axisSessions"

type Props = {
  params: Promise<{
    id: string
  }>
}

export default async function SessionPage({
  params,
}: Props) {
  const { id } = await params

  const session =
    await getAxisSession(id)

  return (
    <div className="min-h-screen bg-black p-6 text-white">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <h1 className="text-4xl font-bold tracking-[0.25em]">
          AXIS REPLAY
        </h1>

        <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
          <p className="text-sm uppercase tracking-[0.2em] text-neutral-500">
            {session.file_name}
          </p>

          <p className="mt-2 text-xs text-neutral-600">
            {new Date(
              session.created_at
            ).toLocaleString()}
          </p>
        </div>

        <video
          className="w-full rounded-2xl"
          controls
          playsInline
          src={session.video_url}
        />
      </div>
    </div>
  )
}