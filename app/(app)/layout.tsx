import { FinanceProvider } from "@/components/finance-provider";
import { AppShell } from "@/components/app-shell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <FinanceProvider>
      <AppShell>{children}</AppShell>
    </FinanceProvider>
  );
}
