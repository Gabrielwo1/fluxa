import { writer } from "@/lib/erp/http";
import { loadDemo, removeDemo } from "@/lib/erp/services/demo";

export const maxDuration = 60;
export const POST = writer(async ({ tenant }) => {
  await loadDemo(tenant);
  return { ok: true };
});
export const DELETE = writer(async ({ tenant }) => {
  await removeDemo(tenant);
  return { ok: true };
});
