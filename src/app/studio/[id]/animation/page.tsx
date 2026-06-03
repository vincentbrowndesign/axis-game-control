import { redirect } from "next/navigation";

export default async function LegacyAnimationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/replay/${id}`);
}
