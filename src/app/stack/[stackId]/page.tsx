import { redirect } from "next/navigation";

export const metadata = {
  title: "Stack | PROOF",
};

export default async function StackPage({
  params,
}: {
  params: Promise<{ stackId: string }>;
}) {
  const { stackId } = await params;

  redirect(`/proof/stacks/${stackId}`);
}
