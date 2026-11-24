import { LoginForm } from "./login-form";

export const metadata = { title: "Entrar" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/tana-logo.png" alt="Tana Studio" className="mx-auto h-28 w-auto" />
          <p className="mt-4 text-sm text-muted">Calendario de contenidos, aprobaciones y presupuesto.</p>
        </div>
        {error && (
          <p className="mb-4 rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger" role="alert">
            El link venció o ya se usó. Pedí uno nuevo.
          </p>
        )}
        <LoginForm next={next ?? "/"} />
        <p className="mt-8 text-center text-xs text-muted">
          ¿No tenés acceso? Escribile a Tana Studio y te invitamos.
        </p>
      </div>
    </main>
  );
}
