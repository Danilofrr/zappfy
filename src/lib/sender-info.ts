export type SenderInfo = {
  name: string;
  address: string;
  district: string;
  city: string;
  cep: string;
  cnpj: string;
};

const KEY = "zappfy:sender-info";

export const emptySender: SenderInfo = {
  name: "",
  address: "",
  district: "",
  city: "",
  cep: "",
  cnpj: "",
};

export function getSenderInfo(): SenderInfo {
  if (typeof window === "undefined") return emptySender;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return emptySender;
    return { ...emptySender, ...(JSON.parse(raw) as Partial<SenderInfo>) };
  } catch {
    return emptySender;
  }
}

export function saveSenderInfo(info: SenderInfo) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(info));
  } catch {
    /* ignore quota */
  }
}
