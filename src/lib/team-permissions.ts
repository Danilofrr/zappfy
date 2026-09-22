export type TeamPermission =
  | "dashboard"
  | "orders"
  | "tracking"
  | "inventory"
  | "returns"
  | "couriers"
  | "reports"
  | "finance"
  | "ads"
  | "checkout"
  | "integrations"
  | "settings";

export const TEAM_PERMISSION_OPTIONS: Array<{
  key: TeamPermission;
  label: string;
  description: string;
  path: string;
  sensitive?: boolean;
}> = [
  { key: "orders", label: "Pedidos", description: "Ver e gerenciar pedidos, clientes e status.", path: "/pedidos" },
  { key: "couriers", label: "Motoboys", description: "Central de motoboys, carga, entregas e agendamentos.", path: "/motoboys" },
  { key: "tracking", label: "Rastreamento", description: "Acompanhar o rastreamento das entregas.", path: "/rastreamento" },
  { key: "checkout", label: "Checkout", description: "Acessar a personalização e o link público do checkout.", path: "/personalizar-checkout" },
  { key: "inventory", label: "Estoque", description: "Acessar produtos e controle de estoque.", path: "/produtos" },
  { key: "returns", label: "Trocas e devoluções", description: "Acompanhar trocas e devoluções.", path: "/trocas" },
  { key: "ads", label: "Meta Ads", description: "Acompanhar investimento, CPA e ROAS.", path: "/ads", sensitive: true },
  { key: "reports", label: "Relatórios", description: "Acessar relatórios e indicadores.", path: "/relatorios", sensitive: true },
  { key: "finance", label: "Financeiro e lucro", description: "Acessar custos, despesas, lucro, DRE, taxas e precificação.", path: "/financeiro", sensitive: true },
  { key: "dashboard", label: "Dashboard", description: "Ver a Dashboard principal. Exige acesso financeiro para mostrar lucro.", path: "/", sensitive: true },
  { key: "integrations", label: "Integrações", description: "Acessar integrações conectadas à loja.", path: "/integracoes" },
  { key: "settings", label: "Configurações", description: "Alterar configurações gerais da loja.", path: "/configuracoes", sensitive: true },
];

export function permissionForPath(pathname: string): TeamPermission | "owner" | null {
  if (pathname === "/") return "dashboard";
  if (pathname.startsWith("/pedidos")) return "orders";
  if (pathname.startsWith("/rastreamento") || pathname.startsWith("/personalizar-rastreamento")) return "tracking";
  if (pathname.startsWith("/produtos") || pathname.startsWith("/compras")) return "inventory";
  if (pathname.startsWith("/trocas")) return "returns";
  if (pathname.startsWith("/motoboys")) return "couriers";
  if (
    pathname.startsWith("/por-produto") ||
    pathname.startsWith("/indicadores") ||
    pathname.startsWith("/metas") ||
    pathname.startsWith("/relatorios")
  ) return "reports";
  if (
    pathname.startsWith("/financeiro") ||
    pathname.startsWith("/dre") ||
    pathname.startsWith("/precificacao") ||
    pathname.startsWith("/taxas")
  ) return "finance";
  if (pathname.startsWith("/ads")) return "ads";
  if (pathname.startsWith("/personalizar-checkout")) return "checkout";
  if (pathname.startsWith("/integracoes")) return "integrations";
  if (pathname.startsWith("/configuracoes")) return "settings";
  if (pathname.startsWith("/equipe") || pathname.startsWith("/minha-assinatura") || pathname.startsWith("/planos")) return "owner";
  if (pathname.startsWith("/sem-acesso") || pathname.startsWith("/assinatura-bloqueada")) return null;
  return null;
}

export function firstAllowedPath(permissions: string[]) {
  const preferred: TeamPermission[] = [
    "orders",
    "couriers",
    "tracking",
    "checkout",
    "inventory",
    "returns",
    "ads",
    "reports",
    "finance",
    "dashboard",
    "integrations",
    "settings",
  ];
  const key = preferred.find((permission) => permissions.includes(permission));
  return TEAM_PERMISSION_OPTIONS.find((item) => item.key === key)?.path ?? "/sem-acesso";
}
