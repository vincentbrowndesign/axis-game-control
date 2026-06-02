import { ProofProduct } from "../../../../components/ProofProduct";

export const metadata = {
  title: "Session | PROOF",
};

export default async function ProofSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;

  return <ProofProduct sessionId={sessionId} view="session" />;
}
