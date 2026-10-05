import type { Metadata } from "next";
import { Presentation } from "@/components/deck/presentation";

export const metadata: Metadata = {
  title: "Apresentação",
  description: "Entenda o produto e por que um financeiro totalmente personalizável muda a rotina da empresa.",
  robots: { index: false },
};

export default function PresentationPage() {
  return <Presentation />;
}
