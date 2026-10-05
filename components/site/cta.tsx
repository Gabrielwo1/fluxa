import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// link com aparência de botão (o Button desta versão não aceita asChild)
export function CtaLink({
  href,
  children,
  variant = "default",
  className,
}: {
  href: string;
  children: React.ReactNode;
  variant?: "default" | "outline" | "ghost";
  className?: string;
}) {
  return (
    <a
      href={href}
      className={cn(
        buttonVariants({ variant }),
        "h-12 rounded-full px-6 text-base font-semibold",
        className
      )}
    >
      {children}
    </a>
  );
}
