import { LiveRecordingPlayback } from "./LiveRecordingPlayback"

type LiveRecordingPageProps = {
  params: Promise<{
    id: string
  }>
}

export default async function LiveRecordingPage({ params }: LiveRecordingPageProps) {
  const { id } = await params

  return <LiveRecordingPlayback id={id} />
}
