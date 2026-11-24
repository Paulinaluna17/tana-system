import { redirect } from "next/navigation";

export default async function ClienteIndex({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/clientes/${slug}/calendario`);
}
