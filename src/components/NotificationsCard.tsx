import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Bell, BellOff, Send, Loader2, AlertTriangle, Smartphone, Share } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  isLovablePreviewHost,
  getCurrentSubscription,
  subscribeToPush,
  unsubscribeFromPush,
  getPushSupportStatus,
  isIOS,
  isStandalonePWA,
  type PushUnsupportedReason,
} from "@/lib/push-client";
import {
  saveSubscription,
  deleteSubscription,
  sendTestNotification,
} from "@/lib/notifications.functions";

export function NotificationsCard() {
  const [status, setStatus] = useState<PushUnsupportedReason>("ssr");
  const [preview, setPreview] = useState(false);
  const [iosDevice, setIosDevice] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState<"" | "enable" | "disable" | "test">("");

  const save = useServerFn(saveSubscription);
  const del = useServerFn(deleteSubscription);
  const test = useServerFn(sendTestNotification);

  useEffect(() => {
    setStatus(getPushSupportStatus());
    setPreview(isLovablePreviewHost());
    setIosDevice(isIOS());
    setStandalone(isStandalonePWA());
    if (typeof Notification !== "undefined") setPermission(Notification.permission);
    (async () => {
      const sub = await getCurrentSubscription();
      setActive(!!sub);
    })();
  }, []);

  const supported = status === "ok";
  const iosNeedsPwa = status === "ios-needs-pwa";
  const blocked = permission === "denied";

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
      if (typeof Notification !== "undefined") setPermission(Notification.permission);
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
      const a = new Audio("/cash-register.mp3");
      a.volume = 1;
      await a.play().catch(() => {});
    } catch (_) {}
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

      {iosNeedsPwa && (
        <div className="flex items-start gap-2 rounded-lg border border-blue-500/40 bg-blue-500/10 p-3 text-[12px]">
          <Smartphone className="h-4 w-4 mt-0.5 text-blue-500 shrink-0" />
          <div className="space-y-1">
            <div className="font-medium">Instale o Zappfy na Tela de Início para ativar as notificações</div>
            <div className="text-muted-foreground">
              No iPhone, abra este site pelo <strong>Safari</strong>, toque no botão <Share className="inline h-3 w-3 -mt-0.5" /> <strong>Compartilhar</strong> e depois em <strong>Adicionar à Tela de Início</strong>. Em seguida, abra o app pelo ícone e ative as notificações por aqui.
            </div>
          </div>
        </div>
      )}

      {!iosNeedsPwa && status !== "ok" && status !== "ssr" && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-[12px]">
          <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-500 shrink-0" />
          <span>Este navegador não suporta Web Push. Use Chrome/Edge no Android ou instale o app na tela inicial.</span>
        </div>
      )}

      {preview && supported && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-[12px]">
          <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-500 shrink-0" />
          <span>As notificações só funcionam no app publicado (não no preview do Lovable). Abra <strong>app.zappfy.shop</strong> para ativar.</span>
        </div>
      )}

      {blocked && supported && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-[12px]">
          <AlertTriangle className="h-4 w-4 mt-0.5 text-rose-500 shrink-0" />
          <span>
            Você bloqueou as notificações deste dispositivo. {iosDevice
              ? "Vá em Ajustes > Notificações > Zappfy e ative Permitir Notificações. Se não aparecer, remova o app da tela inicial e adicione novamente."
              : "Abra as configurações do navegador para este site e permita as notificações."}
          </span>
        </div>
      )}

      <div className="rounded-lg border border-border p-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium flex items-center gap-2">
            {active ? <Bell className="h-4 w-4 text-emerald-500" /> : <BellOff className="h-4 w-4 text-muted-foreground" />}
            Notificações neste dispositivo
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            Status: {active
              ? "ativas"
              : blocked
                ? "bloqueadas pelo navegador"
                : iosNeedsPwa
                  ? "instale o app na tela inicial"
                  : "inativas"}
            {iosDevice && standalone ? " · iOS PWA" : iosDevice ? " · iOS Safari" : ""}
          </div>
        </div>
        {active ? (
          <Button size="sm" variant="outline" onClick={disable} disabled={!!busy}>
            {busy === "disable" ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellOff className="h-4 w-4 mr-1.5" />}
            Desativar
          </Button>
        ) : (
          <Button size="sm" onClick={enable} disabled={!!busy || !supported || blocked}>
            {busy === "enable" ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Bell className="h-4 w-4 mr-1.5" />}
            Ativar notificações
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
