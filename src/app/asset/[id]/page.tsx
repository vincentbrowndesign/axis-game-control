import { AssetDetail } from "../../../components/AxisCloud";

export default async function AssetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AssetDetail assetId={id} />;
}
