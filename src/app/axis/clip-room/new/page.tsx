import { redirect } from "next/navigation";

type Props = { searchParams: Promise<{ mode?: string }> };

export default async function ClipRoomNewRedirect({ searchParams }: Props) {
  const params = await searchParams;
  redirect(params.mode === "record" ? "/record" : "/upload");
}
