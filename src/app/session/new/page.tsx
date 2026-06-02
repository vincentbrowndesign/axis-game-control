import { redirect } from "next/navigation";

export const metadata = {
  title: "Start Session | PROOF",
};

export default function NewSessionPage() {
  redirect("/proof/session/new");
}
