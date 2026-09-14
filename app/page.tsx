import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function Page() {
  return (
    <main className="min-h-screen p-6">
      <nav className="flex items-center justify-between">
        <Link href="/" className="font-semibold">
          newtime.fun
        </Link>
        <Button size="lg">
          <Link href="/login">Login</Link>
      </Button>
      </nav>
    </main>
  )
}
