"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { classify, creditSigns, type Flow } from "@/lib/finance";
import { merchantKey, recategorize, type CategoryRules } from "@/lib/categorize";
import { monthKey, shiftMonth } from "@/lib/format";
import { segmentOf, type Segment } from "@/lib/segments";

const PluggyConnect = dynamic(
  () => import("react-pluggy-connect").then((m) => m.PluggyConnect),
  { ssr: false }
);

export type Account = {
  id: string;
  itemId: string;
  type: "BANK" | "CREDIT";
  name: string;
  marketingName?: string | null;
  balance: number;
  currencyCode: string;
};

export type Tx = {
  id: string;
  accountId: string;
  description: string;
  amount: number;
  date: string;
  category?: string | null;
  type: "DEBIT" | "CREDIT";
  // categoria original do banco, quando a recategorização a trocou
  originalCategory?: string | null;
};

export type Bill = { id: string; name: string; amount: number; day: number };

export type Investment = {
  id: string;
  name: string;
  type: string;
  balance: number;
};

export type MonthAgg = {
  key: string;
  future: boolean;
  income: number;
  fixed: number;
  card: number;
  bank: number;
  expense: number;
  invest: number;
};

export type SegmentItem = {
  id: string;
  merchant: string;
  description: string;
  date: string;
  value: number;
  channel?: "card" | "bank";
};

export type SegmentTotal = {
  seg: Segment;
  total: number;
  // por categoria: total e cada lançamento (nome e valor)
  cats: Map<string, { total: number; items: SegmentItem[] }>;
};

export const FUTURE_MONTHS = 12;

export type Me = {
  mode: "supabase" | "mvp" | "local";
  email: string | null;
  isStaff: boolean;
  role: "owner" | "editor" | "viewer";
  client: { id: string; name: string };
  clients: { id: string; name: string; slug: string }[];
};

class SessionExpired extends Error {}

// sessão expirada leva ao login; erros da API viram mensagem
async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (res.status === 401) throw new SessionExpired();
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((json as { error?: string }).error ?? `Erro ${res.status}`);
  }
  return json as T;
}

const send = <T,>(url: string, method: string, body: unknown) =>
  api<T>(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

type Finance = {
  ready: boolean;
  me: Me | null;
  loading: boolean;
  error: string | null;
  itemIds: string[];
  accounts: Account[];
  txs: Tx[];
  investments: Investment[];
  bills: Bill[];
  accountName: Map<string, string>;
  flowOf: (t: Tx) => Flow;

  totalBalance: number;
  totalCredit: number;
  totalInvested: number;
  fixedTotal: number;

  currentKey: string;
  firstKey: string;
  lastKey: string;
  selectedMonth: string;
  winStart: string;
  selectMonth: (key: string) => void;
  aggOf: (key: string) => MonthAgg;
  months: MonthAgg[];
  cur: MonthAgg;
  prev: MonthAgg;
  monthTxs: Tx[];
  segments: SegmentTotal[];
  segmentsTotal: number;

  rules: CategoryRules;
  setCategoryRule: (key: string, category: string | null) => Promise<void>;

  refresh: () => Promise<void>;
  startConnect: () => Promise<void>;
  connecting: boolean;
  startSandbox: () => Promise<void>;
  sandboxStatus: string | null;
  removeItem: (itemId: string) => Promise<void>;
  addBill: (name: string, amount: number, day: number) => Promise<void>;
  removeBill: (id: string) => Promise<void>;
};

const Ctx = createContext<Finance | null>(null);

export function useFinance(): Finance {
  const v = useContext(Ctx);
  if (!v) throw new Error("useFinance fora do FinanceProvider");
  return v;
}

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const [itemIds, setItemIds] = useState<string[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [rawTxs, setRawTxs] = useState<Tx[]>([]);
  const [rules, setRules] = useState<CategoryRules>({});
  const [me, setMe] = useState<Me | null>(null);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectToken, setConnectToken] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [ready, setReady] = useState(false);
  const [sandboxStatus, setSandboxStatus] = useState<string | null>(null);

  const router = useRouter();

  const handleError = useCallback(
    (e: unknown) => {
      if (e instanceof SessionExpired) {
        router.replace("/login");
        return;
      }
      setError(e instanceof Error ? e.message : String(e));
    },
    [router]
  );

  const currentKey = monthKey(new Date());
  const lastKey = shiftMonth(currentKey, FUTURE_MONTHS);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentKey);
  // primeiro mês da janela de 6 meses do gráfico (3 passados, atual e 2 futuros)
  const [winStart, setWinStart] = useState<string>(shiftMonth(currentKey, -3));

  const loadData = useCallback(async (ids: string[]) => {
    if (ids.length === 0) {
      setAccounts([]);
      setRawTxs([]);
      setInvestments([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // uma conexão com problema não derruba as outras, mas o motivo aparece na tela
      let problem: string | null = null;
      const fetchList = async <T,>(url: string): Promise<T[]> => {
        try {
          const res = await fetch(url);
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            problem ??= (body as { error?: string }).error ?? `Erro ${res.status}`;
            return [];
          }
          const data = await res.json();
          return (data.results ?? []) as T[];
        } catch (e) {
          problem ??= e instanceof Error ? e.message : String(e);
          return [];
        }
      };
      const [accountLists, investmentLists] = await Promise.all([
        Promise.all(ids.map((id) => fetchList<Account>(`/api/accounts?itemId=${id}`))),
        Promise.all(
          ids.map((id) => fetchList<Investment>(`/api/investments?itemId=${id}`))
        ),
      ]);
      const allAccounts = accountLists.flat();
      setAccounts(allAccounts);
      setInvestments(investmentLists.flat());

      const since = new Date();
      since.setMonth(since.getMonth() - 12);
      const from = since.toISOString().slice(0, 10);
      const txLists = await Promise.all(
        allAccounts.map((acc) =>
          fetchList<Tx>(`/api/transactions?accountId=${acc.id}&from=${from}`)
        )
      );
      setRawTxs(txLists.flat().sort((a, b) => b.date.localeCompare(a.date)));
      if (problem) setError(problem);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [reg, fb, cr, who] = await Promise.all([
          api<{ ids: string[] }>("/api/registry"),
          api<{ bills: Bill[] }>("/api/fixed-bills"),
          api<{ rules: CategoryRules }>("/api/category-rules"),
          api<Me>("/api/me"),
        ]);
        setMe(who);
        setBills(fb.bills ?? []);
        setRules(cr.rules ?? {});
        const ids = reg.ids ?? [];
        setItemIds(ids);
        await loadData(ids);
      } catch (e) {
        handleError(e);
      } finally {
        setReady(true);
      }
    })();
  }, [loadData, handleError]);

  const addItem = useCallback(
    async (id: string) => {
      try {
        const data = await send<{ ids: string[] }>("/api/registry", "POST", { id });
        setItemIds(data.ids);
        await loadData(data.ids);
      } catch (e) {
        handleError(e);
      }
    },
    [loadData, handleError]
  );

  const removeItem = useCallback(
    async (itemId: string) => {
      try {
        const data = await send<{ ids: string[] }>("/api/registry", "DELETE", {
          id: itemId,
        });
        setItemIds(data.ids);
        await loadData(data.ids);
      } catch (e) {
        handleError(e);
      }
    },
    [loadData, handleError]
  );

  const startConnect = useCallback(async () => {
    setConnecting(true);
    setError(null);
    try {
      const res = await fetch("/api/connect-token", { method: "POST" });
      const data = await res.json();
      if (!data.accessToken) throw new Error(data.error ?? "Sem accessToken");
      setConnectToken(data.accessToken);
    } catch (e) {
      setError(String(e));
      setConnecting(false);
    }
  }, []);

  const startSandbox = useCallback(async () => {
    setSandboxStatus("Criando conexão…");
    setError(null);
    try {
      const res = await fetch("/api/sandbox", { method: "POST" });
      const data = await res.json();
      if (!data.id) throw new Error(data.error ?? "Falha ao criar item de teste");
      setSandboxStatus("Sincronizando…");
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const st = await fetch(`/api/items?id=${data.id}`).then((r) => r.json());
        if (st.status === "UPDATED") break;
        if (st.status === "LOGIN_ERROR" || st.status === "OUTDATED") {
          throw new Error(`Sincronização falhou: ${st.status}`);
        }
      }
      await addItem(data.id);
    } catch (e) {
      setError(String(e));
    } finally {
      setSandboxStatus(null);
    }
  }, [addItem]);

  const addBill = useCallback(
    async (name: string, amount: number, day: number) => {
      try {
        const data = await send<{ bills: Bill[] }>("/api/fixed-bills", "POST", {
          name,
          amount,
          day,
        });
        setBills(data.bills ?? []);
      } catch (e) {
        handleError(e);
      }
    },
    [handleError]
  );

  const removeBill = useCallback(async (id: string) => {
    try {
      const data = await send<{ bills: Bill[] }>("/api/fixed-bills", "DELETE", { id });
      setBills(data.bills ?? []);
    } catch (e) {
      handleError(e);
    }
  }, [handleError]);

  // ----- derivados -----

  const txs = useMemo<Tx[]>(
    () => recategorize(rawTxs, rules) as Tx[],
    [rawTxs, rules]
  );

  const setCategoryRule = useCallback(
    async (key: string, category: string | null) => {
      try {
        const data = await send<{ rules: CategoryRules }>(
          "/api/category-rules",
          "POST",
          { key, category }
        );
        setRules(data.rules ?? {});
      } catch (e) {
        handleError(e);
      }
    },
    [handleError]
  );

  const accountName = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of accounts) map.set(a.id, a.marketingName || a.name);
    return map;
  }, [accounts]);

  const accountTypeMap = useMemo(() => {
    const map = new Map<string, Account["type"]>();
    for (const a of accounts) map.set(a.id, a.type);
    return map;
  }, [accounts]);

  const signs = useMemo(() => creditSigns(accounts, txs), [accounts, txs]);

  const flowOf = useCallback(
    (t: Tx): Flow =>
      classify(t, accountTypeMap.get(t.accountId), signs.get(t.accountId)),
    [accountTypeMap, signs]
  );

  const totalBalance = accounts
    .filter((a) => a.type === "BANK")
    .reduce((s, a) => s + a.balance, 0);
  const totalCredit = accounts
    .filter((a) => a.type === "CREDIT")
    .reduce((s, a) => s + a.balance, 0);
  const totalInvested = investments.reduce(
    (s, i) => s + (i.balance > 0 ? i.balance : 0),
    0
  );
  const fixedTotal = bills.reduce((s, b) => s + b.amount, 0);

  const firstKey = useMemo(() => {
    const floor = shiftMonth(currentKey, -11);
    if (txs.length === 0) return currentKey;
    const oldest = txs[txs.length - 1].date.slice(0, 7);
    return oldest > floor ? oldest : floor;
  }, [txs, currentKey]);

  // passados: lançamentos reais; futuros: contas fixas + parcelas do cartão
  const monthAggs = useMemo(() => {
    const map = new Map<string, { income: number; card: number; bank: number; invest: number }>();
    for (const t of txs) {
      const k = t.date.slice(0, 7);
      const m = map.get(k) ?? { income: 0, card: 0, bank: 0, invest: 0 };
      const f = flowOf(t);
      if (f.kind === "income") m.income += f.value;
      else if (f.kind === "invest") m.invest += f.value;
      else if (f.kind === "expense") {
        if (f.channel === "card") m.card += f.value;
        else m.bank += f.value;
      }
      map.set(k, m);
    }
    return map;
  }, [txs, flowOf]);

  const aggOf = useCallback(
    (k: string): MonthAgg => {
      const base = monthAggs.get(k) ?? { income: 0, card: 0, bank: 0, invest: 0 };
      const future = k > currentKey;
      const card = Math.max(0, base.card);
      const bank = Math.max(0, base.bank);
      // contas fixas só entram nos meses futuros; no atual e nos anteriores
      // elas já estão nos lançamentos reais
      const fixed = future ? fixedTotal : 0;
      return {
        key: k,
        future,
        income: base.income,
        fixed,
        card,
        bank,
        expense: fixed + card + bank,
        invest: base.invest,
      };
    },
    [monthAggs, currentKey, fixedTotal]
  );

  const months = useMemo<MonthAgg[]>(
    () => Array.from({ length: 6 }, (_, i) => aggOf(shiftMonth(winStart, i))),
    [aggOf, winStart]
  );

  const selectMonth = useCallback(
    (key: string) => {
      if (key < firstKey || key > lastKey) return;
      setSelectedMonth(key);
      setWinStart((ws) =>
        key < ws ? key : key > shiftMonth(ws, 5) ? shiftMonth(key, -5) : ws
      );
    },
    [firstKey, lastKey]
  );

  const cur = aggOf(selectedMonth);
  const prev = aggOf(shiftMonth(selectedMonth, -1));

  const monthTxs = useMemo(
    () => txs.filter((t) => t.date.startsWith(selectedMonth)),
    [txs, selectedMonth]
  );

  const segments = useMemo<SegmentTotal[]>(() => {
    const map = new Map<string, SegmentTotal>();
    for (const t of monthTxs) {
      const f = flowOf(t);
      if (f.kind !== "expense") continue;
      const seg = segmentOf(t.category);
      const entry = map.get(seg.id) ?? { seg, total: 0, cats: new Map() };
      entry.total += f.value;
      const c = t.category || "Sem categoria";
      const cat = entry.cats.get(c) ?? { total: 0, items: [] };
      cat.total += f.value;
      cat.items.push({
        id: t.id,
        merchant: merchantKey(t.description),
        description: t.description,
        date: t.date,
        value: f.value,
        channel: f.channel,
      });
      entry.cats.set(c, cat);
      map.set(seg.id, entry);
    }
    return Array.from(map.values())
      .filter((e) => e.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [monthTxs, flowOf]);

  const segmentsTotal = segments.reduce((s, e) => s + e.total, 0);

  const refresh = useCallback(() => loadData(itemIds), [loadData, itemIds]);

  const value: Finance = {
    ready,
    me,
    loading,
    error,
    itemIds,
    accounts,
    txs,
    investments,
    bills,
    accountName,
    flowOf,
    totalBalance,
    totalCredit,
    totalInvested,
    fixedTotal,
    currentKey,
    firstKey,
    lastKey,
    selectedMonth,
    winStart,
    selectMonth,
    aggOf,
    months,
    cur,
    prev,
    monthTxs,
    segments,
    segmentsTotal,
    rules,
    setCategoryRule,
    refresh,
    startConnect,
    connecting,
    startSandbox,
    sandboxStatus,
    removeItem,
    addBill,
    removeBill,
  };

  return (
    <Ctx.Provider value={value}>
      {children}
      {connectToken && (
        <PluggyConnect
          connectToken={connectToken}
          connectorIds={[200]}
          onSuccess={(data: { item: { id: string } }) => {
            setConnectToken(null);
            setConnecting(false);
            addItem(data.item.id);
          }}
          onError={(e: unknown) => {
            setError(`Erro na conexão: ${JSON.stringify(e)}`);
            setConnectToken(null);
            setConnecting(false);
          }}
          onClose={() => {
            setConnectToken(null);
            setConnecting(false);
          }}
        />
      )}
    </Ctx.Provider>
  );
}
