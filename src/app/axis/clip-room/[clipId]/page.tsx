import { ClipRoomDetail } from "../../../../components/clip-room/ClipRoomDetail";

export const metadata = { title: "Clip — Axis" };

type Props = { params: Promise<{ clipId: string }> };

export default async function ClipDetailPage({ params }: Props) {
  const { clipId } = await params;
  return <ClipRoomDetail clipId={clipId} />;
}
