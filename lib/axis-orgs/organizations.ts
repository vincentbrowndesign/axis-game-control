import {
  AXIS_ACTIVE_ROUTE_SEGMENTS,
  AXIS_ARCHIVED_UX_SEGMENTS,
} from "@/lib/axis-active-product/routes"

export type AxisOrganization = {
  avatar: string
  id: string | null
  logo: string
  name: string
  slug: string
}

const STATIC_ORGANIZATIONS: AxisOrganization[] = [
  {
    avatar: "BR",
    id: null,
    logo: "BR",
    name: "Bridge",
    slug: "bridge",
  },
  {
    avatar: "C2",
    id: null,
    logo: "C2",
    name: "City 2 City",
    slug: "city2city",
  },
]

const RESERVED_SLUGS = new Set([
  "api",
  ...AXIS_ACTIVE_ROUTE_SEGMENTS,
  ...AXIS_ARCHIVED_UX_SEGMENTS,
])

export function isReservedOrganizationSlug(slug: string) {
  return RESERVED_SLUGS.has(slug.toLowerCase())
}

export async function getAxisOrganizationBySlug(slug: string) {
  const normalized = normalizeOrganizationSlug(slug)

  if (!normalized || isReservedOrganizationSlug(normalized)) return null

  return STATIC_ORGANIZATIONS.find((org) => org.slug === normalized) || null
}

export async function ensureAxisOrganizationBySlug(slug: string) {
  const normalized = normalizeOrganizationSlug(slug)

  if (!normalized || isReservedOrganizationSlug(normalized)) return null

  return STATIC_ORGANIZATIONS.find((org) => org.slug === normalized) || null
}

export function normalizeOrganizationSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 64)
}
