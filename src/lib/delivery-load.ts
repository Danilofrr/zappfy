export type DeliveryAssignment = {
  id: string;
  order_id: string;
  courier_id: string | null;
  courier_name: string | null;
  status: string;
  assigned_at: string | null;
  scheduled_for: string | null;
};

export type CourierLoad = {
  courier_id: string;
  name: string;
  active: boolean;
  is_online: boolean;
  online_updated_at: string | null;
  in_route: boolean;
  orders_in_possession: number;
  products_in_possession: number;
  value_in_possession: number;
  delivered_today: number;
  products_delivered_today: number;
  failed: number;
  returned: number;
};

export const possessionStatuses = new Set([
  "preparando",
  "aguardando_motoboy",
  "saiu_para_entrega",
  "chegando",
  "nao_entregue",
  "retornando",
]);

export const deliveryStatusLabel: Record<string, string> = {
  preparando: "Atribuído",
  aguardando_motoboy: "Aguardando saída",
  saiu_para_entrega: "Em rota",
  chegando: "Chegando",
  entregue: "Entregue",
  nao_entregue: "Não entregue",
  retornando: "Retornando",
  devolvido: "Devolvido à loja",
  cancelado: "Cancelado",
};
