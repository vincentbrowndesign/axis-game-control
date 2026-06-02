import { CreateProduct } from "../../components/AxisCloud";

export default async function CreatePage({
  searchParams,
}: {
  searchParams: Promise<{ asset?: string; dataset?: string; model?: string }>;
}) {
  const params = await searchParams;
  return (
    <CreateProduct
      initialAssetId={params.asset}
      initialDatasetId={params.dataset}
      initialModelId={params.model}
    />
  );
}
