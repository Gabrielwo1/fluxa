"use client";

import { useEffect, useState } from "react";

// botão fixo no celular; some quando o formulário já está na tela
export function StickyCta() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const target = document.getElementById("diagnostico");
    if (!target) return;
    const io = new IntersectionObserver(
      ([entry]) => setHidden(entry.isIntersecting),
      { threshold: 0.15 }
    );
    io.observe(target);
    return () => io.disconnect();
  }, []);

  if (hidden) return null;
  return (
    <div className="fixed inset-x-3 bottom-3 z-30 md:hidden">
      <a
        href="#diagnostico"
        className="flex h-13 items-center justify-center rounded-full bg-primary text-base font-bold text-primary-foreground shadow-xl"
      >
        Agendar diagnóstico gratuito
      </a>
    </div>
  );
}
