import { redirect } from "next/navigation"
import { getAxisRequestIdentity } from "@/lib/axis-auth/identity"

export default async function PlayerHistoryPage() {
  const identity = await getAxisRequestIdentity()

  if (!identity) {
    redirect("/sign-in?redirect_url=/player/history")
  }

  redirect("/profile")
}
