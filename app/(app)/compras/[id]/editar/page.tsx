import { PurchaseFormPage } from "@/components/erp/purchases-pages";

export default async function EditarCompraPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PurchaseFormPage key={id} purchaseId={id} />;
}
