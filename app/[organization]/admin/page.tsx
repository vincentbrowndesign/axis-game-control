import { redirect } from "next/navigation"

type OrganizationAdminPageProps = {
  params: Promise<{
    organization: string
  }>
}

export default async function OrganizationAdminPage({
  params,
}: OrganizationAdminPageProps) {
  const { organization: organizationSlug } = await params
  redirect(`/org/${organizationSlug}`)
}
