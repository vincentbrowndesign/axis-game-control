import { ModelDetail } from "../../../components/AxisCloud";

export default async function ModelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ModelDetail modelId={id} />;
}
