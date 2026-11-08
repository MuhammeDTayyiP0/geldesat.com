import { useEffect, useState } from "react";

type View = "list" | "grid";
const KEY = "gs-view";

/**
 * List or grid for listing pages, remembered on this device and the same on
 * search and category pages. The first render uses the default (the server
 * cannot know the choice), then the saved one.
 */
export function useViewPreference(): [View, (view: View) => void] {
  const [view, setView] = useState<View>("grid");
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(KEY);
      if (saved === "list" || saved === "grid") setView(saved);
    } catch {
      // Storage blocked: the default stays.
    }
  }, []);
  const choose = (next: View) => {
    setView(next);
    try {
      window.localStorage.setItem(KEY, next);
    } catch {
      // Not remembered, still switched.
    }
  };
  return [view, choose];
}
