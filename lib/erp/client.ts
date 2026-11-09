"use client";

import { useCallback, useEffect, useState } from "react";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
  }
}

async function parse<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- recarrega por completo para limpar o estado
    window.location.assign("/login");
    throw new ApiError("Sessão expirada. Entre de novo.", 401);
  }
  if (!res.ok) throw new ApiError((data as { error?: string }).error ?? "Algo deu errado. Tente novamente.", res.status);
  return data as T;
}

// Chamada de escrita (POST, PUT, DELETE). Lança ApiError com a mensagem do servidor, em português.
export async function call<T = unknown>(method: "POST" | "PUT" | "DELETE", url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return parse<T>(res);
}

export type Api<T> = {
  data: T | undefined;
  error: string | null;
  loading: boolean;
  reload: () => void;
};

// Busca dados de uma rota e refaz a busca quando a URL muda ou quando reload() é chamado.
// Enquanto recarrega, continua mostrando os dados anteriores (sem piscar a tela).
export function useApi<T>(url: string | null): Api<T> {
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<{ key: string; data?: T; error: string | null }>({ key: "", error: null });
  const key = url ? `${url}#${version}` : "";

  useEffect(() => {
    if (!url) return;
    let off = false;
    fetch(url)
      .then((r) => parse<T>(r))
      .then((data) => {
        if (!off) setState({ key, data, error: null });
      })
      .catch((e: Error) => {
        if (!off) setState((s) => ({ key, data: s.data, error: e.message }));
      });
    return () => {
      off = true;
    };
  }, [url, key]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { data: state.data, error: state.key === key ? state.error : null, loading: Boolean(url) && state.key !== key, reload };
}

export const qs = (params: Record<string, string | number | boolean | undefined | null>) => {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : "";
};
