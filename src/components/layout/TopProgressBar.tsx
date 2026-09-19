import { useRouterState } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";

export function TopProgressBar() {
  const isPending = useRouterState({
    select: (s) => s.status === "pending",
  });

  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const finishTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isPending) {
      // Önceki bitiş zamanlayıcılarını temizle
      if (finishTimeoutRef.current) clearTimeout(finishTimeoutRef.current);
      if (timerRef.current) clearInterval(timerRef.current);

      setVisible(true);
      setProgress(15);

      // İlerleme simülasyonu: 15% -> 40% -> 70% -> 85%
      timerRef.current = setInterval(() => {
        setProgress((prev) => {
          if (prev < 40) return prev + 15;
          if (prev < 70) return prev + 8;
          if (prev < 88) return prev + 3;
          return prev;
        });
      }, 150);
    } else {
      // Yükleme tamamlandı: %100'e fırla ve tatlıca kaybol
      if (timerRef.current) clearInterval(timerRef.current);

      setProgress(100);
      finishTimeoutRef.current = setTimeout(() => {
        setVisible(false);
        finishTimeoutRef.current = setTimeout(() => {
          setProgress(0);
        }, 200);
      }, 250);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (finishTimeoutRef.current) clearTimeout(finishTimeoutRef.current);
    };
  }, [isPending]);

  if (!visible && progress === 0) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[9999] h-[2.5px] overflow-hidden bg-transparent"
    >
      <div
        className="h-full top-progress-bar-glow transition-all duration-200 ease-out"
        style={{
          width: `${progress}%`,
          opacity: visible ? 1 : 0,
        }}
      />
    </div>
  );
}
