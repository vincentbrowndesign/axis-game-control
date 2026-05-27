import { notFound, redirect } from "next/navigation"
import { normalizeOrganizationSlug } from "@/lib/axis-orgs/organizations"

type OrgRouteProps = {
  params: Promise<{
    organization: string
  }>
}

const ACTIVE_ORGANIZATIONS = new Set(["bridge", "city2city"])

export default async function OrgRoute({ params }: OrgRouteProps) {
  const { organization } = await params
  const organizationSlug = normalizeOrganizationSlug(organization)

  if (!ACTIVE_ORGANIZATIONS.has(organizationSlug)) {
    notFound()
  }

  redirect(`/org/${organizationSlug}/start`)
}
