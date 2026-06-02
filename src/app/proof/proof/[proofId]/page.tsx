import { redirect } from "next/navigation";

export const metadata = {
  title: "Proof | PROOF",
};

export default async function ProofDetailPage({
  params,
}: {
  params: Promise<{ proofId: string }>;
}) {
  await params;
  redirect("/");
}
