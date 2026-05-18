import { SequenceConsole } from "@/components/axis/SequenceConsole"

export default async function SequencePage(props: PageProps<"/sequence/[id]">) {
  const { id } = await props.params

  return <SequenceConsole sequenceId={id} />
}
