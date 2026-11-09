import { PurchaseDetailPage } from "@/components/erp/purchases-pages";

export default async function CompraPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PurchaseDetailPage key={id} id={id} />;
}
