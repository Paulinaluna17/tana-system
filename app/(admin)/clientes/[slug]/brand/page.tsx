import { requireWorkspace } from "@/lib/auth";
import { BrandForm } from "@/components/admin/brand-form";

export default async function BrandPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { workspace } = await requireWorkspace(slug);
  return <BrandForm workspace={workspace} />;
}
