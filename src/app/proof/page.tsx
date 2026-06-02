import { redirect } from "next/navigation";

export const metadata = {
  title: "PROOF",
  description: "Session-first proof.",
};

export default function ProofPage() {
  redirect("/");
}
