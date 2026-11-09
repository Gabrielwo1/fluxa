import { SaleFormPage } from "@/components/erp/sale-form";

export default async function NovaVendaPage({ searchParams }: { searchParams: Promise<{ cliente?: string; duplicar?: string }> }) {
  const sp = await searchParams;
  return <SaleFormPage key={`${sp.duplicar ?? ""}${sp.cliente ?? ""}`} duplicateId={sp.duplicar} customerId={sp.cliente} />;
}
