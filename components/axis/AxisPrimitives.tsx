import Link from "next/link"
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react"
import { AxisCommandToolbar } from "@/components/axis/AxisCommandToolbar"

type AxisTone = "primary" | "secondary" | "ghost"

function joinClasses(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ")
}

export function AxisPage({
  children,
  className,
  max = "max-w-7xl",
  center = false,
  ...props
}: HTMLAttributes<HTMLElement> & {
  max?: string
  center?: boolean
}) {
  return (
    <main
      {...props}
      className={joinClasses(
        "axis-display axis-sync-room axis-familiar-room axis-world-state axis-os-field min-h-dvh text-white",
        className
      )}
    >
      <section
        className={joinClasses(
          "relative mx-auto flex min-h-dvh w-full flex-col px-4 py-4 sm:px-6",
          max,
          center && "items-center justify-center text-center"
        )}
      >
        {children}
        <div className="sticky bottom-3 z-30 mt-auto pt-6">
          <AxisCommandToolbar />
        </div>
      </section>
    </main>
  )
}

export function AxisHeader({
  title = "AXIS",
  href = "/live",
  children,
  className,
}: {
  title?: string
  href?: string
  children?: ReactNode
  className?: string
}) {
  return (
    <header className={joinClasses("axis-world-header flex items-center justify-between py-3", className)}>
      <Link
        href={href}
        className="axis-mono axis-world-link text-[11px] font-black uppercase tracking-[0.28em] transition"
      >
        {title}
      </Link>
      {children ? <nav className="axis-world-nav">{children}</nav> : null}
    </header>
  )
}

export function AxisSurface({
  children,
  className,
  as: Component = "section",
  ...props
}: HTMLAttributes<HTMLElement> & {
  as?: "section" | "article" | "div" | "form"
}) {
  return (
    <Component {...props} className={joinClasses("axis-sync-surface axis-world-panel axis-os-surface", className)}>
      {children}
    </Component>
  )
}

export function AxisButton({
  children,
  className,
  tone = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: AxisTone
}) {
  return (
    <button
      {...props}
      className={joinClasses(
        "axis-mono axis-optical-transition px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] transition disabled:cursor-wait disabled:opacity-50",
        tone === "primary" && "axis-familiar-primary",
        tone === "secondary" && "axis-familiar-control",
        tone === "ghost" && "axis-sync-surface",
        className
      )}
    >
      {children}
    </button>
  )
}

export function AxisLinkButton({
  children,
  className,
  tone = "secondary",
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string
  tone?: AxisTone | "retrieval"
}) {
  return (
    <Link
      {...props}
      href={props.href}
      className={joinClasses(
        "axis-mono axis-optical-transition px-4 py-3 text-center text-[10px] font-black uppercase tracking-[0.16em] transition",
        tone === "primary" && "axis-familiar-primary",
        tone === "secondary" && "axis-familiar-control",
        tone === "ghost" && "axis-world-link",
        tone === "retrieval" && "axis-retrieval-link",
        className
      )}
    >
      {children}
    </Link>
  )
}

export function AxisActionGrid({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={joinClasses("grid gap-2 sm:grid-cols-2", className)}>{children}</div>
}

export function AxisScorebug({
  home,
  away,
  clock,
  status,
  className,
}: {
  home: number | string
  away: number | string
  clock: string
  status: string
  className?: string
}) {
  return (
    <div className={joinClasses("axis-broadcast-scorebug mx-auto grid max-w-xl grid-cols-[1fr_auto_1fr] items-stretch overflow-hidden", className)}>
      <div className="grid min-w-0 grid-cols-[auto_1fr] items-center">
        <span className="axis-broadcast-chip axis-mono grid h-full min-w-16 place-items-center px-3 text-[10px] font-black uppercase tracking-[0.16em]">
          HOME
        </span>
        <span className="axis-mono grid place-items-center px-4 text-2xl font-black tabular-nums text-white sm:text-3xl">
          {home}
        </span>
      </div>
      <div className="grid min-w-24 place-items-center border-x border-white/12 px-3 py-2 text-center">
        <span className="axis-mono text-[14px] font-black tabular-nums text-white">{clock}</span>
        <span className="axis-mono mt-1 text-[8px] font-black uppercase tracking-[0.16em] text-white/48">
          {status}
        </span>
      </div>
      <div className="grid min-w-0 grid-cols-[1fr_auto] items-center">
        <span className="axis-mono grid place-items-center px-4 text-2xl font-black tabular-nums text-white sm:text-3xl">
          {away}
        </span>
        <span className="axis-broadcast-chip axis-mono grid h-full min-w-16 place-items-center px-3 text-[10px] font-black uppercase tracking-[0.16em]">
          AWAY
        </span>
      </div>
    </div>
  )
}

export function AxisStatCard({
  label,
  value,
  detail,
  className,
}: {
  label: string
  value: ReactNode
  detail?: ReactNode
  className?: string
}) {
  return (
    <AxisSurface as="article" className={joinClasses("p-4", className)}>
      <p className="axis-mono axis-world-kicker text-[10px] font-black uppercase tracking-[0.18em]">
        {label}
      </p>
      <p className="axis-world-title mt-3 text-3xl font-black uppercase leading-none">{value}</p>
      {detail ? <div className="axis-mono mt-3 text-[10px] font-black uppercase tracking-[0.14em] text-white/42">{detail}</div> : null}
    </AxisSurface>
  )
}

export function AxisReplayFrame({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <AxisSurface className={joinClasses("overflow-hidden", className)}>{children}</AxisSurface>
}

export function AxisTimeline({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={joinClasses("axis-familiar-bar border px-3 py-2", className)}>
      {children}
    </div>
  )
}

export function AxisClipCard({
  href,
  kicker,
  title,
  meta,
  badge,
}: {
  href: string
  kicker: string
  title: string
  meta: ReactNode
  badge?: ReactNode
}) {
  return (
    <Link
      href={href}
      className="axis-familiar-bar axis-world-panel axis-optical-transition block p-4 transition hover:bg-white/[0.055]"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="axis-mono truncate text-[10px] font-black uppercase tracking-[0.18em] text-white/52">
            {kicker}
          </p>
          <h2 className="mt-2 truncate text-lg font-black uppercase tracking-normal text-white/88">
            {title}
          </h2>
        </div>
        {badge ? (
          <div className="axis-broadcast-chip axis-world-badge axis-mono shrink-0 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em]">
            {badge}
          </div>
        ) : null}
      </div>
      <div className="axis-mono mt-5 flex items-center justify-between gap-3 text-[10px] font-black uppercase tracking-[0.14em] text-white/42">
        {meta}
      </div>
    </Link>
  )
}

export function AxisEmptyState({
  title,
  children,
  className,
}: {
  title: string
  children?: ReactNode
  className?: string
}) {
  return (
    <AxisSurface className={joinClasses("grid min-h-64 place-items-center p-6 text-center", className)}>
      <div>
        <p className="text-2xl font-black uppercase tracking-normal text-white/80">{title}</p>
        {children ? <div className="mt-3 max-w-xl text-sm font-bold text-white/42">{children}</div> : null}
      </div>
    </AxisSurface>
  )
}
