"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

// Foto do banco de imagens, ilustrativa (nunca apresentada como equipe ou cliente).
// Se o arquivo não existir no deploy, mostra um fundo em degradê em vez de imagem quebrada.
export function Photo({
  src,
  alt,
  className,
  caption,
  position = "center",
  priority = false,
  sizes = "(min-width: 1024px) 45vw, 100vw",
}: {
  src: string;
  alt: string;
  className?: string;
  caption?: string;
  position?: string;
  priority?: boolean;
  sizes?: string;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <figure
      className={cn("relative overflow-hidden rounded-3xl bg-muted", className)}
      // o erro pode acontecer antes de a hidratação ligar o onError
      ref={(node) => {
        const img = node?.querySelector("img");
        if (img && img.complete && img.naturalWidth === 0) {
          queueMicrotask(() => setFailed(true));
        }
      }}
    >
      {failed ? (
        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(135deg,color-mix(in_oklch,var(--primary)_35%,transparent),var(--muted)_55%,color-mix(in_oklch,var(--primary)_15%,transparent))]"
        />
      ) : (
        <Image
          src={src}
          alt={alt}
          fill
          priority={priority}
          sizes={sizes}
          className="object-cover"
          style={{ objectPosition: position }}
          onError={() => setFailed(true)}
        />
      )}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent"
      />
      {caption && (
        <figcaption className="absolute bottom-4 left-4 right-4 w-fit max-w-full rounded-full bg-card/90 px-4 py-2 text-xs font-semibold text-card-foreground backdrop-blur">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
