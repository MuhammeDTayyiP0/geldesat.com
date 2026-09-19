import { forwardRef } from "react";
import { cn, maskPhoneInput } from "@/lib/utils";
import { Phone } from "lucide-react";

export interface PhoneInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRawChange?: (rawDigits: string) => void;
  showFlag?: boolean;
}

export const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(
  (
    {
      className,
      value = "",
      onChange,
      onRawChange,
      showFlag = true,
      placeholder = "05xx xxx xx xx",
      disabled,
      ...props
    },
    ref,
  ) => {
    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      const masked = maskPhoneInput(e.target.value);
      e.target.value = masked;

      if (onChange) {
        onChange(e);
      }
      if (onRawChange) {
        onRawChange(masked.replace(/\D/g, ""));
      }
    }

    return (
      <div className="relative flex items-center">
        {showFlag ? (
          <div className="pointer-events-none absolute left-3 flex items-center gap-1.5 text-xs font-semibold text-muted select-none">
            <span role="img" aria-label="Türkiye" className="text-base leading-none">
              🇹🇷
            </span>
            <span className="text-subtle font-mono text-[11px]">+90</span>
            <span className="h-4 w-px bg-border/80" />
          </div>
        ) : (
          <Phone className="pointer-events-none absolute left-3 size-4 text-subtle" />
        )}
        <input
          ref={ref}
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          maxLength={14}
          value={maskPhoneInput(value)}
          onChange={handleChange}
          disabled={disabled}
          placeholder={placeholder}
          className={cn(
            "h-11 w-full rounded-md border border-border bg-surface text-base text-fg placeholder:text-subtle outline-none transition-[border-color,box-shadow] duration-150 focus:border-primary focus:ring-2 focus:ring-primary/20 md:text-sm font-sans tabular-nums",
            showFlag ? "pl-20 pr-3 font-mono tracking-wide" : "pl-10 pr-3 font-mono",
            disabled && "opacity-50 cursor-not-allowed bg-elevated/50",
            className,
          )}
          {...props}
        />
      </div>
    );
  },
);

PhoneInput.displayName = "PhoneInput";
