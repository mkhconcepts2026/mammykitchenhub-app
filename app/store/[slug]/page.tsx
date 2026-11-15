import { redirect } from "next/navigation";

export default async function StoreSlugRedirect({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const safeSlug = String(slug ?? "").trim();
  if (!safeSlug) redirect("/");
  redirect(`/vendors/${encodeURIComponent(safeSlug)}`);
}