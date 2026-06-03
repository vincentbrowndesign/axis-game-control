import { redirect } from "next/navigation";

export default async function StudioArtifactPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/replay/${id}`);
}
