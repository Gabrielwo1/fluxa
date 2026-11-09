import { Tag } from "@/components/erp/ui";
import type { PurchaseStatus, SaleStatus, Title } from "@/lib/erp/types";

export function SaleStatusTag({ status }: { status: SaleStatus }) {
  return status === "confirmed" ? <Tag tone="good">Confirmada</Tag> : status === "canceled" ? <Tag tone="bad">Cancelada</Tag> : <Tag tone="info">Orçamento</Tag>;
}

export function PurchaseStatusTag({ status }: { status: PurchaseStatus }) {
  return status === "received" ? <Tag tone="good">Recebida</Tag> : status === "canceled" ? <Tag tone="bad">Cancelada</Tag> : <Tag tone="info">Rascunho</Tag>;
}

export function TitleStatusTag({ title }: { title: Pick<Title, "status" | "overdue" | "days_late"> }) {
  if (title.status === "paid") return <Tag tone="good">Pago</Tag>;
  if (title.overdue) return <Tag tone="bad">Atrasado {title.days_late}d</Tag>;
  return <Tag tone="warn">Em aberto</Tag>;
}
