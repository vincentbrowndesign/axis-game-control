import { type NextRequest, NextResponse } from "next/server"

const ALLOWED_PAGE_PATHS = new Set([
  "/",
  "/org/bridge/start",
  "/org/city2city/start",
  "/org/bridge/train",
  "/org/city2city/train",
  "/org/bridge/coach",
  "/org/city2city/coach",
])

const ALLOWED_API_PATHS = new Set([
  "/api/org/bridge/check-in",
  "/api/org/bridge/check-out",
  "/api/org/city2city/check-in",
  "/api/org/city2city/check-out",
])

function isAllowedPath(pathname: string) {
  return ALLOWED_PAGE_PATHS.has(pathname.replace(/\/$/, "") || "/")
}

function isAllowedApiPath(pathname: string) {
  return ALLOWED_API_PATHS.has(pathname.replace(/\/$/, ""))
}

export default function axisProxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (isAllowedPath(pathname) || isAllowedApiPath(pathname)) {
    return NextResponse.next({ request })
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.redirect(new URL("/", request.url))
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
}
