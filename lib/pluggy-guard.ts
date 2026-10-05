import { HttpError, type Tenant } from "@/lib/tenant";
import { listConnectionIds } from "@/lib/store";
import { pluggyFetch } from "@/lib/pluggy";

// Um cliente só pode consultar itens (e contas) que estão registrados para ele.
export async function assertItemAllowed(t: Tenant, itemId: string): Promise<void> {
  const ids = await listConnectionIds(t);
  if (!ids.includes(itemId)) {
    throw new HttpError(403, "Esta conexão não pertence ao seu cliente");
  }
}

// accountId -> itemId nunca muda, então vale guardar para não repetir a consulta
const accountItem = new Map<string, string>();

export async function assertAccountAllowed(t: Tenant, accountId: string): Promise<void> {
  let itemId = accountItem.get(accountId);
  if (!itemId) {
    const acc = await pluggyFetch<{ itemId: string }>(`/accounts/${accountId}`);
    itemId = acc.itemId;
    accountItem.set(accountId, itemId);
  }
  await assertItemAllowed(t, itemId);
}
