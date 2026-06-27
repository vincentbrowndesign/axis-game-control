import { redirect } from "next/navigation";

type Props = { params: Promise<{ clipId: string }> };

export default async function ClipDetailRedirect({ params }: Props) {
  const { clipId } = await params;
  redirect(`/clips/${clipId}`);
}
