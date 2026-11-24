import { signOut } from "@/app/actions/auth";

export default function SinAcceso() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="font-display text-2xl">Tu usuario todavía no tiene una marca asignada</p>
      <p className="text-sm text-muted">Escribile a Tana Studio para que te den acceso.</p>
      <form action={signOut}>
        <button className="text-accent underline">Salir</button>
      </form>
    </main>
  );
}
