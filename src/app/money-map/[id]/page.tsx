import { MoneyMapSharePage } from "../../../components/midheaven/MoneyMapSharePage";
import { getSharedMoneyMap } from "../../../lib/midheaven/seed";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

export default async function SharedMoneyMapPage({ params }: Props) {
  const { id } = await params;
  return <MoneyMapSharePage moneyMap={getSharedMoneyMap(id)} />;
}
