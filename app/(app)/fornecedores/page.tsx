import { PartiesPage } from "@/components/erp/parties-page";

export default async function FornecedoresPage({ searchParams }: { searchParams: Promise<{ novo?: string }> }) {
  const novo = (await searchParams).novo === "1";
  return <PartiesPage key={novo ? "novo" : "lista"} role="supplier" novo={novo} />;
}
