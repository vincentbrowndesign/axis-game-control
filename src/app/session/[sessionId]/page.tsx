import { ClipnoteSession } from "../../../components/ClipnoteSession";

export default async function SessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return <ClipnoteSession sessionId={sessionId} />;
}
