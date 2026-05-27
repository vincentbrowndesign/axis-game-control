import { supabaseAdmin } from "@/lib/supabase/admin"
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
    avatar: "B",
    id: null,
    logo: "B",
    name: "BTC",
    slug: "btc",
  },
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

  const fromDatabase = await readOrganization(normalized)

  if (fromDatabase) return fromDatabase

  return STATIC_ORGANIZATIONS.find((org) => org.slug === normalized) || null
}

export function normalizeOrganizationSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 64)
}

async function readOrganization(slug: string): Promise<AxisOrganization | null> {
  const result = await Promise.race([
    supabaseAdmin
      .from("axis_organizations")
      .select("id, name, slug, avatar, logo")
      .eq("slug", slug)
      .maybeSingle<{
        avatar: string | null
        id: string
        logo: string | null
        name: string
        slug: string
      }>(),
    timeoutOrganizationResult(2500),
  ])

  if (result.error || !result.data) return null

  return {
    avatar:
      result.data.logo ||
      result.data.avatar ||
      result.data.name.slice(0, 2).toUpperCase(),
    id: result.data.id,
    logo:
      result.data.logo ||
      result.data.avatar ||
      result.data.name.slice(0, 2).toUpperCase(),
    name: result.data.name,
    slug: result.data.slug,
  }
}

function timeoutOrganizationResult(milliseconds: number) {
  return new Promise<{
    data: null
    error: Error
  }>((resolve) => {
    setTimeout(
      () =>
        resolve({
          data: null,
          error: new Error("Organization lookup timed out"),
        }),
      milliseconds
    )
  })
}
