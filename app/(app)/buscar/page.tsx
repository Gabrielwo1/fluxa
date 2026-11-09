import { Suspense } from "react";
import { SearchPage } from "@/components/erp/search-page";

export default function BuscarPage() {
  return (
    <Suspense fallback={null}>
      <SearchPage />
    </Suspense>
  );
}
