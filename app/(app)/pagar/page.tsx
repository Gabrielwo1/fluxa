import { TitlesPage } from "@/components/erp/titles-page";

export default async function PagarPage({ searchParams }: { searchParams: Promise<{ novo?: string }> }) {
  const novo = (await searchParams).novo === "1";
  return <TitlesPage key={novo ? "novo" : "lista"} direction="out" novo={novo} />;
}
