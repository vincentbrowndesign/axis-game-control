import { redirect } from "next/navigation";

export const metadata = {
  title: "Session | PROOF",
};

export default async function ProofSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  redirect(`/asset/session-${sessionId}`);
}
