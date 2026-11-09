import { FinanceProvider } from "@/components/finance-provider";
import { AppShell } from "@/components/app-shell";
import { Toaster } from "@/components/erp/toaster";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <FinanceProvider>
      <AppShell>{children}</AppShell>
      <Toaster />
    </FinanceProvider>
  );
}
