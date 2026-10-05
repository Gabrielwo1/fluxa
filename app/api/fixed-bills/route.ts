import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { HttpError, getTenant } from "@/lib/tenant";
import { addBill, listBills, removeBill } from "@/lib/store";

export const GET = route(async () => {
  const t = await getTenant();
  return NextResponse.json({ bills: await listBills(t) });
});

export const POST = route(async (req) => {
  const t = await getTenant();
  const { name, amount, day } = await req.json();
  const value = Number(amount);
  if (!name || typeof name !== "string" || !(value > 0)) {
    throw new HttpError(400, "name e amount obrigatórios");
  }
  await addBill(t, { name: name.trim().slice(0, 160), amount: value, day: Number(day) });
  return NextResponse.json({ bills: await listBills(t) });
});

export const DELETE = route(async (req) => {
  const t = await getTenant();
  const { id } = await req.json();
  if (!id) throw new HttpError(400, "id obrigatório");
  await removeBill(t, id);
  return NextResponse.json({ bills: await listBills(t) });
});
