import CreatePlayerForm from "@/components/CreatePlayerForm"

export default function NewPlayerPage() {
  return (
    <main className="min-h-screen bg-black px-5 py-10 text-white">
      <div className="mx-auto flex w-full max-w-md flex-col gap-6">
        <CreatePlayerForm />
      </div>
    </main>
  )
}