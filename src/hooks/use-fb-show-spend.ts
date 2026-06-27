import { useEffect, useState, useCallback } from "react";

const KEY = "zappfy:fb_show_spend_dashboard";

function read(): boolean {
  if (typeof window === "undefined") return true;
  const v = window.localStorage.getItem(KEY);
  return v === null ? true : v === "1";
}

export function useFbShowSpend(): [boolean, (v: boolean) => void] {
  const [value, setValue] = useState<boolean>(true);

  useEffect(() => {
    setValue(read());
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setValue(read());
    };
    const onCustom = () => setValue(read());
    window.addEventListener("storage", onStorage);
    window.addEventListener("fb-show-spend-changed", onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("fb-show-spend-changed", onCustom);
    };
  }, []);

  const update = useCallback((v: boolean) => {
    window.localStorage.setItem(KEY, v ? "1" : "0");
    setValue(v);
    window.dispatchEvent(new Event("fb-show-spend-changed"));
  }, []);

  return [value, update];
}
