import { redirect } from "next/navigation";

export const metadata = {
  title: "PROOF",
  description: "Sessions.",
};

export default function ProofPage() {
  redirect("/");
}
