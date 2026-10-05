import Image from "next/image";
import { cn } from "@/lib/utils";

// foto do banco de imagens, ilustrativa (nunca apresentada como equipe ou cliente)
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
  return (
    <figure
      className={cn("relative overflow-hidden rounded-3xl bg-muted", className)}
    >
      <Image
        src={src}
        alt={alt}
        fill
        priority={priority}
        sizes={sizes}
        className="object-cover"
        style={{ objectPosition: position }}
      />
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
