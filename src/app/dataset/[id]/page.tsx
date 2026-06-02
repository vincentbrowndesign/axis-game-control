import { DatasetDetail } from "../../../components/AxisCloud";

export default async function DatasetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DatasetDetail datasetId={id} />;
}
