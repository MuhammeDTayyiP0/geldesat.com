import { cn } from "@/lib/utils";

interface LogoMarkProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
  size?: number | string;
}

/** Uploaded GeldeSat mark — stroke paths, color via `currentColor`. */
export function LogoMark({ className, size = 32, width, height, ...props }: LogoMarkProps) {
  const w = width ?? size;
  const h = height ?? size;

  return (
    <svg
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      width={w}
      height={h}
      className={cn("block shrink-0", className)}
      fill="none"
      aria-hidden="true"
      {...props}
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
