import { LogoMark } from "@/components/brand/LogoMark";
import { cn } from "@/lib/utils";

interface BrandSpinnerProps {
  /** Boyut seçeneği: xs (20px), sm (28px), md (40px), lg (56px), xl (72px) */
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  /** Altında görüntülenecek bilgilendirme metni */
  text?: string;
  /** Ekstra CSS sınıfları */
  className?: string;
  /** Sayfa ortasında geniş bir alana yayılacaksa true */
  fullPage?: boolean;
}

const SIZE_MAP = {
  xs: "size-5",
  sm: "size-7",
  md: "size-10",
  lg: "size-14",
  xl: "size-18",
};

const PIXEL_MAP = {
  xs: 20,
  sm: 28,
  md: 40,
  lg: 56,
  xl: 72,
};

export function BrandSpinner({
  size = "md",
  text,
  className,
  fullPage = false,
}: BrandSpinnerProps) {
  const iconClass = SIZE_MAP[size];
  const pixelSize = PIXEL_MAP[size];

  const content = (
    <div className={cn("inline-flex flex-col items-center justify-center gap-3 select-none", className)}>
      <div className="relative flex items-center justify-center">
        {/* Arkadaki hafif neon parıltı çemberi */}
        <div className="absolute inset-0 rounded-full bg-primary/10 blur-md transition-transform" />
        
        {/* Hızlanıp yavaşlayan 360° döngülü GeldeSat amblemi */}
        <div className="animate-brand-spin text-primary">
          <LogoMark size={pixelSize} className={iconClass} />
        </div>
      </div>

      {text ? (
        <p className="text-xs font-medium tracking-wide text-muted animate-pulse">
          {text}
        </p>
      ) : null}
    </div>
  );

  if (fullPage) {
    return (
      <div className="flex min-h-[50vh] flex-1 items-center justify-center p-8">
        {content}
      </div>
    );
  }

  return content;
}
