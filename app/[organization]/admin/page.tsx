import { notFound, redirect } from "next/navigation"
import { normalizeOrganizationSlug } from "@/lib/axis-orgs/organizations"

type OrganizationAdminShortcutPageProps = {
  params: Promise<{
    organization: string
  }>
}

const ACTIVE_ORGANIZATIONS = new Set(["bridge", "city2city"])

export default async function OrganizationAdminShortcutPage({
  params,
}: OrganizationAdminShortcutPageProps) {
  const { organization } = await params
  const organizationSlug = normalizeOrganizationSlug(organization)

  if (!ACTIVE_ORGANIZATIONS.has(organizationSlug)) {
    notFound()
  }

  redirect(`/org/${organizationSlug}/coach`)
}
