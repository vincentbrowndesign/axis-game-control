import { redirect } from "next/navigation";

export const metadata = {
  title: "Session | PROOF",
};

export default async function SessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;

  redirect(`/proof/session/${sessionId}`);
}
