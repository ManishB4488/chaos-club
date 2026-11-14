import Link from "next/link";
import { Loader2 } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

type ButtonStyleProps = {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
};

const BASE =
  "inline-flex touch-manipulation select-none items-center justify-center gap-2 rounded-pill font-display font-semibold transition duration-150 disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-linear-to-r from-bubblegum to-tangerine text-night-950 shadow-[0_5px_0_0_rgb(0_0_0/0.35)] hover:brightness-110 active:translate-y-[3px] active:shadow-[0_2px_0_0_rgb(0_0_0/0.35)]",
  secondary:
    "border-2 border-white/15 bg-night-800 text-ink hover:bg-night-700 active:translate-y-px",
  ghost: "text-ink-soft hover:bg-white/10 hover:text-ink",
  danger:
    "border-2 border-bubblegum/40 bg-bubblegum/15 text-ink hover:bg-bubblegum/25 active:translate-y-px",
};

// Every size is at least 44px tall, the minimum comfortable touch target.
const SIZES: Record<Size, string> = {
  sm: "min-h-11 px-4 text-sm",
  md: "min-h-12 px-6 text-base",
  lg: "min-h-14 px-8 text-lg",
};

export function buttonStyles({
  variant = "primary",
  size = "md",
  fullWidth = false,
}: ButtonStyleProps = {}) {
  return cn(BASE, VARIANTS[variant], SIZES[size], fullWidth && "w-full");
}

type ButtonProps = ComponentProps<"button"> & ButtonStyleProps & { loading?: boolean };

export function Button({
  variant,
  size,
  fullWidth,
  loading = false,
  disabled,
  className,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(buttonStyles({ variant, size, fullWidth }), className)}
      {...props}
    >
      {loading && <Loader2 aria-hidden className="size-5 animate-spin" />}
      {children}
    </button>
  );
}

type ButtonLinkProps = ComponentProps<typeof Link> & ButtonStyleProps;

/** A link (page navigation) that looks like a button. */
export function ButtonLink({ variant, size, fullWidth, className, ...props }: ButtonLinkProps) {
  return <Link className={cn(buttonStyles({ variant, size, fullWidth }), className)} {...props} />;
}
