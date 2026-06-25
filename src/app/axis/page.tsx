import { AxisShell } from "../../components/axis/AxisShell";

type AxisPageProps = {
  searchParams?: Promise<{ view?: string }>;
};

export default async function AxisPage({ searchParams }: AxisPageProps) {
  const params = await searchParams;
  const initialNav = params?.view === "review" ? "memory" : "session";
  return <AxisShell initialNav={initialNav} />;
}
