import { ClipRoomNew } from "../../../../components/clip-room/ClipRoomNew";

export const metadata = { title: "New Clip — Axis" };

type Props = { searchParams: Promise<{ mode?: string }> };

export default async function ClipRoomNewPage({ searchParams }: Props) {
  const params = await searchParams;
  const mode = params.mode === "record" ? "record" : "upload";
  return <ClipRoomNew mode={mode} />;
}
