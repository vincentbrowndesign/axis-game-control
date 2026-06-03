import { ProductDetail } from "../../../components/AxisCloud";

export default async function StudioArtifactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProductDetail productId={id} />;
}
