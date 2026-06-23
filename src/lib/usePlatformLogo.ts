import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPublicPlatformBrand } from "@/lib/admin.functions";

export const FALLBACK_LOGO = "/logo-full.png";

export function usePlatformLogo() {
  const fn = useServerFn(getPublicPlatformBrand);
  const q = useQuery({
    queryKey: ["public-platform-brand"],
    queryFn: () => fn(),
    staleTime: 5 * 60_000,
  });
  return {
    logoUrl: q.data?.logoUrl || FALLBACK_LOGO,
    sidebarLogo: q.data?.sidebarLogo || q.data?.logoUrl || FALLBACK_LOGO,
    brandName: q.data?.brandName || "ZappFy",
  };
}
