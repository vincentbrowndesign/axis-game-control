import { ButtonHTMLAttributes } from "react"
import { AxisButton as AxisWorldButton } from "@/components/axis/AxisPrimitives"

type Props = ButtonHTMLAttributes<HTMLButtonElement>

export default function AxisButton({
  children,
  className = "",
  ...props
}: Props) {
  return <AxisWorldButton {...props} className={`w-full px-6 py-5 text-lg ${className}`}>{children}</AxisWorldButton>
}
