import { ReportConsole } from "@/components/axis/ReportConsole"

export default async function ReportPage(props: PageProps<"/report/[id]">) {
  const { id } = await props.params

  return <ReportConsole reportId={id} />
}
