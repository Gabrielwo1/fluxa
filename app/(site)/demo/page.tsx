import type { Metadata } from "next";
import { DemoEntry } from "@/components/demo-entry";

export const metadata: Metadata = {
  title: "Demonstração",
  description: "Teste o sistema com uma empresa de exemplo, sem cadastro.",
  robots: { index: false },
};

export default function DemoPage() {
  return <DemoEntry />;
}
