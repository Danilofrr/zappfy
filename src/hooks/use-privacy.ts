import { useEffect, useState, useCallback } from "react";

const KEY = "zappfy:privacy";
const EVT = "zappfy:privacy-changed";

function read(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(KEY) === "1";
}

export function usePrivacy() {
  const [on, setOn] = useState<boolean>(() => read());

  useEffect(() => {
    const handler = () => setOn(read());
    window.addEventListener(EVT, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(EVT, handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const toggle = useCallback(() => {
    const next = !read();
    window.localStorage.setItem(KEY, next ? "1" : "0");
    window.dispatchEvent(new Event(EVT));
    setOn(next);
  }, []);

  return { on, toggle };
}

export function mask(value: string | number, on: boolean): string {
  if (!on) return String(value);
  return "••••••";
}
