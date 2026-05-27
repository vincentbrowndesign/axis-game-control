import { redirect } from "next/navigation"
import { getAxisRequestIdentity } from "@/lib/axis-auth/identity"
import { getAxisMembershipWorlds } from "@/lib/axis-orgs/memberships"

export default async function PlayerPage() {
  const identity = await getAxisRequestIdentity()

  if (!identity) {
    redirect("/sign-in?redirect_url=/player")
  }

  const memberships = await getAxisMembershipWorlds(identity)
  const playerWorld = memberships[0]

  if (!playerWorld) {
    redirect("/player/join")
  }

  redirect(`/player/check-in?org=${playerWorld.organizationSlug}`)
}
