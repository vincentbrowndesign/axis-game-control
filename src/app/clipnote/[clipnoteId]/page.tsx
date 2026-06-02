import { ClipnoteSingle } from "../../../components/ClipnoteSingle";

export default async function ClipnotePage({
  params,
}: {
  params: Promise<{ clipnoteId: string }>;
}) {
  const { clipnoteId } = await params;
  return <ClipnoteSingle clipnoteId={clipnoteId} />;
}
