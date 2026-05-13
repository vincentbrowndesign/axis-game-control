// app/session/[id]/page.tsx

import AxisReplayClient from "@/components/AxisReplayClient"

type PageProps = {
  params: Promise<{
    id: string
  }>
}

export default async function SessionPage({
  params,
}: PageProps) {
  const { id } = await params

  return (
    <main className="min-h-screen bg-black">
      <AxisReplayClient sessionId={id} />
    </main>
  )
}