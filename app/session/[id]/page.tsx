import AxisReplayClient from "@/components/AxisReplayClient";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

export default async function Page({
  params,
}: Props) {
  const { id } = await params;

  return <AxisReplayClient sessionId={id} />;
}