import { redirect } from "next/navigation";

export default async function ClipnotePage({
  params,
}: {
  params: Promise<{ clipnoteId: string }>;
}) {
  const { clipnoteId } = await params;
  redirect(`/asset/clipnote-${clipnoteId}`);
}
