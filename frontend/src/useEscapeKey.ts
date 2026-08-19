import { useEffect } from "react";

/** Calls `onEscape` whenever the Escape key is pressed -- shared by every modal so Escape
    closes it, the same as clicking the backdrop already does. */
export function useEscapeKey(onEscape: () => void) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onEscape();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onEscape]);
}
