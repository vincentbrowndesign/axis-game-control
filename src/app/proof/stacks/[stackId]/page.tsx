import { ProofProduct } from "../../../../components/ProofProduct";

export const metadata = {
  title: "Stack | PROOF",
};

export default async function ProofStackPage({
  params,
}: {
  params: Promise<{ stackId: string }>;
}) {
  const { stackId } = await params;

  return <ProofProduct stackId={stackId} view="stack" />;
}
