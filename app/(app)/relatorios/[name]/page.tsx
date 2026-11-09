import { ReportViewPage } from "@/components/erp/reports-pages";

export default async function RelatorioPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  return <ReportViewPage key={name} name={name} />;
}
