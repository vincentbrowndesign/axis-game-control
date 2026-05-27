import { type NextRequest, NextResponse } from "next/server"
import { clerkMiddleware } from "@clerk/nextjs/server"
import { createServerClient } from "@supabase/ssr"
import { isArchivedAxisUxSegment } from "@/lib/axis-active-product/routes"
import { hasValidClerkServerConfig } from "@/lib/axis-auth/clerkConfig"

async function axisProxy(request: NextRequest) {
  const firstSegment = request.nextUrl.pathname.split("/").filter(Boolean)[0]

  if (firstSegment && isArchivedAxisUxSegment(firstSegment)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  let response = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )

          response = NextResponse.next({
            request,
          })

          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  await supabase.auth.getClaims()

  return response
}

export default hasValidClerkServerConfig()
  ? clerkMiddleware(async (_auth, request: NextRequest) => axisProxy(request))
  : axisProxy

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/__clerk/(.*)",
    "/(api|trpc)(.*)",
  ],
}
