"use client";

import { useEffect, useState } from "react";

export const CDI_FALLBACK = 14;

// CDI atual (Banco Central) uma vez por página; sem resposta, usa um valor padrão.
export function useCdi(): { cdi: number; live: boolean; date: string | null } {
  const [state, setState] = useState<{ cdi: number; live: boolean; date: string | null }>({
    cdi: CDI_FALLBACK,
    live: false,
    date: null,
  });
  useEffect(() => {
    let off = false;
    fetch("/api/cdi")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!off && d && typeof d.cdi === "number") {
          setState({ cdi: d.cdi, live: true, date: d.date });
        }
      })
      .catch(() => {});
    return () => {
      off = true;
    };
  }, []);
  return state;
}
