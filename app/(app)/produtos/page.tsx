import { ProductsPage } from "@/components/erp/products-page";

export default async function ProdutosPage({ searchParams }: { searchParams: Promise<{ novo?: string }> }) {
  const novo = (await searchParams).novo === "1";
  return <ProductsPage key={novo ? "novo" : "lista"} novo={novo} />;
}
