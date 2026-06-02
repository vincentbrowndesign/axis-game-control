import { redirect } from "next/navigation";

export const metadata = {
  title: "Stacks | PROOF",
};

export default function StacksPage() {
  redirect("/proof/stacks");
}
