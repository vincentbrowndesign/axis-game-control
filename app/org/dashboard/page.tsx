import { redirect } from "next/navigation"
import { getAxisRequestIdentity } from "@/lib/axis-auth/identity"
import {
  canManageOrganization,
  getAxisMembershipWorlds,
} from "@/lib/axis-orgs/memberships"

export default async function OrgDashboardPage() {
  const identity = await getAxisRequestIdentity()

  if (!identity) {
    redirect("/sign-in?redirect_url=/org/dashboard")
  }

  const memberships = await getAxisMembershipWorlds(identity)
  const organizationWorld = memberships.find((membership) =>
    canManageOrganization(membership.role),
  )

  if (!organizationWorld) {
    redirect("/org")
  }

  redirect(`/org/${organizationWorld.organizationSlug}`)
}
