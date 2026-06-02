import { redirect } from "next/navigation";

export const metadata = {
  title: "Proof | PROOF",
};

export default async function ProofPage({
  params,
}: {
  params: Promise<{ proofId: string }>;
}) {
  await params;
  redirect("/");
}
