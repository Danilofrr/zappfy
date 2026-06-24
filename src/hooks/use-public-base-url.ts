import { useEffect, useState } from "react";
import { getPublicSupport } from "@/lib/admin.functions";
import { getOfficialPublicBaseUrl } from "@/lib/public-url";

export function usePublicBaseUrl() {
  const [baseUrl, setBaseUrl] = useState(() => getOfficialPublicBaseUrl());

  useEffect(() => {
    let cancelled = false;
    getPublicSupport()
      .then((r: any) => {
        if (!cancelled) setBaseUrl(getOfficialPublicBaseUrl(r?.officialUrl));
      })
      .catch(() => {
        if (!cancelled) setBaseUrl(getOfficialPublicBaseUrl());
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return baseUrl;
}
