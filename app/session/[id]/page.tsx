import { redirect } from "next/navigation"

type Props = {
  params: Promise<{
    id: string
  }>
}

export default async function SessionReplayPage({
  params,
}: Props) {
  const { id } = await params

  redirect(`/replay/${id}`)
}
