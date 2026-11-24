import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="font-display text-3xl">No encontramos esta página</p>
      <p className="text-sm text-muted">Puede que el link esté vencido o que no tengas acceso.</p>
      <Link href="/" className="text-accent underline">
        Volver al inicio
      </Link>
    </main>
  );
}
