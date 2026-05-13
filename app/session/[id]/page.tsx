import AxisReplayClient from "@/components/AxisReplayClient"

import {
  getAxisEvents,
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

  const events =
    await getAxisEvents(id)

  return (
    <div className="min-h-screen bg-black p-6 text-white">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <h1 className="text-4xl font-bold tracking-[0.25em]">
          AXIS REPLAY
        </h1>

        <AxisReplayClient
          session={session}
          initialEvents={events}
        />
      </div>
    </div>
  )
}