import { SaleDetailPage } from "@/components/erp/sales-pages";

export default async function VendaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SaleDetailPage key={id} id={id} />;
}
