import { redirect } from "next/navigation";

export const metadata = {
  title: "Stack | PROOF",
};

export default async function ProofStackPage({
  params,
}: {
  params: Promise<{ stackId: string }>;
}) {
  await params;
  redirect("/models");
}
