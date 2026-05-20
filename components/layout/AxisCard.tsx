import { ReactNode } from "react"
import { AxisSurface } from "@/components/axis/AxisPrimitives"

type Props = {
  children: ReactNode
  className?: string
}

export default function AxisCard({
  children,
  className = "",
}: Props) {
  return <AxisSurface className={`p-6 ${className}`}>{children}</AxisSurface>
}
