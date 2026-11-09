import { SaleFormPage } from "@/components/erp/sale-form";

export default async function EditarVendaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SaleFormPage key={id} saleId={id} />;
}
