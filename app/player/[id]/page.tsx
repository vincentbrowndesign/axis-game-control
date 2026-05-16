import { redirect } from "next/navigation"

type Props = {
  params: Promise<{
    id: string
  }>
}

export default async function PlayerPage({ params }: Props) {
  await params

  redirect("/team/local")
}
