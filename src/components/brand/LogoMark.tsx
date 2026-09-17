import { cn } from "@/lib/utils";

/** Uploaded GeldeSat mark — stroke paths, color via `currentColor`. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("block", className)}
      fill="none"
      aria-hidden
    >
      <path
        d="M36 12 H 24 A 12 12 0 0 0 12 24 V 28 A 4 4 0 0 0 16 32 H 48 A 4 4 0 0 1 52 36 V 40 A 12 12 0 0 1 40 52 H 28"
        stroke="currentColor"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M24 32 H 32" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
    </svg>
  );
}
