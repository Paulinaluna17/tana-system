import { LogIn } from "lucide-react";
import { Button, Card, CardContent } from "@/components/ui";
import { confirmLogin } from "./actions";

export const metadata = { title: "Entrar", robots: { index: false, follow: false } };

/**
 * Link de acceso (magic link / "Link de acceso" por WhatsApp).
 * Muestra un botón en vez de entrar automáticamente: WhatsApp y los lectores de mail abren los links
 * para armar la vista previa y, si entráramos solos, el link de un solo uso quedaría gastado.
 */
export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string; next?: string }>;
}) {
  const { token_hash = "", type = "email", next = "/" } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/tana-logo.png" alt="Tana Studio" className="mx-auto h-24 w-auto" />
        <Card className="mt-6">
          <CardContent className="space-y-4">
            <p className="text-sm text-muted">Tocá el botón para entrar a tu calendario.</p>
            <form action={confirmLogin}>
              <input type="hidden" name="token_hash" value={token_hash} />
              <input type="hidden" name="type" value={type} />
              <input type="hidden" name="next" value={next} />
              <Button size="lg" className="w-full" disabled={!token_hash}>
                <LogIn /> Entrar
              </Button>
            </form>
            {!token_hash && <p className="text-sm text-danger">Este link está incompleto. Pedí uno nuevo.</p>}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
