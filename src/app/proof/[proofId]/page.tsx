import { ProofProduct } from "../../../components/ProofProduct";

export const metadata = {
  title: "Proof | PROOF",
};

export default async function ProofPage({
  params,
}: {
  params: Promise<{ proofId: string }>;
}) {
  const { proofId } = await params;

  return <ProofProduct proofId={proofId} view="proof" />;
}
