import { redirect } from "next/navigation"

export function redirectToLiveThread(): never {
  redirect("/live")
}
