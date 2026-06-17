import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Bell, BellOff, Send, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  isPushSupported,
  isLovablePreviewHost,
  getCurrentSubscription,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push-client";
import {
  saveSubscription,
  deleteSubscription,
  sendTestNotification,
} from "@/lib/notifications.functions";

export function NotificationsCard() {
  const [supported, setSupported] = useState(false);
  const [preview, setPreview] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState<"" | "enable" | "disable" | "test">("");

  const save = useServerFn(saveSubscription);
  const del = useServerFn(deleteSubscription);
  const test = useServerFn(sendTestNotification);

  useEffect(() => {
    setSupported(isPushSupported());
    setPreview(isLovablePreviewHost());
    if (typeof Notification !== "undefined") setPermission(Notification.permission);
    (async () => {
      const sub = await getCurrentSubscription();
      setActive(!!sub);
    })();
  }, []);

  async function enable() {
    setBusy("enable");
    try {
      const sub = await subscribeToPush();
      await save({ data: sub });
      setActive(true);
      setPermission("granted");
      toast.success("Notificações ativadas neste dispositivo!");
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível ativar as notificações");
    } finally {
      setBusy("");
    }
  }

  async function disable() {
    setBusy("disable");
    try {
      const endpoint = await unsubscribeFromPush();
      if (endpoint) await del({ data: { endpoint } });
      setActive(false);
      toast.success("Notificações desativadas neste dispositivo");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao desativar");
    } finally {
      setBusy("");
    }
  }

  async function sendTest() {
    setBusy("test");
    try {
      const r = await test({ data: undefined });
      if (r.sent > 0) toast.success(`Notificação de teste enviada (${r.sent} dispositivo${r.sent > 1 ? "s" : ""})`);
      else toast.warning("Nenhum dispositivo ativo encontrado. Ative as notificações primeiro.");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao enviar teste");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="grid gap-3">
      <p className="text-[12px] text-muted-foreground -mt-1">
        Receba uma notificação no celular toda vez que um cliente finalizar um pedido no checkout.
      </p>

      {!supported && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-[12px]">
          <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-500 shrink-0" />
          <span>Este navegador não suporta Web Push. Use Chrome/Edge no Android ou instale o app na tela inicial.</span>
        </div>
      )}

      {preview && supported && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-[12px]">
          <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-500 shrink-0" />
          <span>As notificações só funcionam no app publicado (não no preview do Lovable). Abra <strong>zappfy.lovable.app</strong> para ativar.</span>
        </div>
      )}

      <div className="rounded-lg border border-border p-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium flex items-center gap-2">
            {active ? <Bell className="h-4 w-4 text-emerald-500" /> : <BellOff className="h-4 w-4 text-muted-foreground" />}
            Notificações neste dispositivo
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            Status: {active ? "ativas" : permission === "denied" ? "bloqueadas pelo navegador" : "inativas"}
          </div>
        </div>
        {active ? (
          <Button size="sm" variant="outline" onClick={disable} disabled={!!busy}>
            {busy === "disable" ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellOff className="h-4 w-4 mr-1.5" />}
            Desativar
          </Button>
        ) : (
          <Button size="sm" onClick={enable} disabled={!!busy || !supported}>
            {busy === "enable" ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Bell className="h-4 w-4 mr-1.5" />}
            Ativar notificações no celular
          </Button>
        )}
      </div>

      <Button variant="outline" onClick={sendTest} disabled={!active || !!busy}>
        {busy === "test" ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Send className="h-4 w-4 mr-1.5" />}
        Enviar notificação de teste
      </Button>
    </div>
  );
}
