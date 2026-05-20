import { ReactNode } from "react"
import { AxisPage } from "@/components/axis/AxisPrimitives"

type Props = {
  children: ReactNode
}

export default function AxisShell({
  children,
}: Props) {
  return <AxisPage max="max-w-[820px]" className="pb-32 pt-6">{children}</AxisPage>
}
