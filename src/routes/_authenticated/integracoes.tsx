import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  saveFacebookIntegration,
  disconnectFacebookIntegration,
  getFacebookIntegrationStatus,
  syncFacebookAds,
} from "@/lib/integrations.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CheckCircle2, AlertCircle, Plug, RefreshCw, ExternalLink, Facebook } from "lucide-react";

export const Route = createFileRoute("/_authenticated/integracoes")({
  head: () => ({ meta: [{ title: "Integrações — Zappfy" }] }),
  component: Page,
});

function Page() {
  const getStatus = useServerFn(getFacebookIntegrationStatus);
  const save = useServerFn(saveFacebookIntegration);
  const disconnect = useServerFn(disconnectFacebookIntegration);
  const sync = useServerFn(syncFacebookAds);

  const [status, setStatus] = useState<Awaited<ReturnType<typeof getFacebookIntegrationStatus>> | null>(null);
  const [token, setToken] = useState("");
  const [account, setAccount] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try {
      const s = await getStatus();
      setStatus(s);
      if (s.ad_account_id) setAccount(s.ad_account_id);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao carregar status");
    }
  }
  useEffect(() => { refresh(); }, []);

  async function handleSave() {
    if (!token || !account) { toast.error("Preencha o token e o ID da conta"); return; }
    setBusy(true);
    try {
      await save({ data: { access_token: token, ad_account_id: account } });
      toast.success("Conta conectada com sucesso");
      setToken("");
      await refresh();
    } catch (e: any) { toast.error(e?.message ?? "Falha ao salvar"); }
    finally { setBusy(false); }
  }

  async function handleSync() {
    setBusy(true);
    try {
      const r = await sync({ data: { days: 30 } });
      toast.success(`Sincronizado: ${r.imported} dia(s) importados`);
      await refresh();
    } catch (e: any) { toast.error(e?.message ?? "Falha ao sincronizar"); }
    finally { setBusy(false); }
  }

  async function handleDisconnect() {
    if (!confirm("Desconectar a conta do Facebook Ads?")) return;
    setBusy(true);
    try {
      await disconnect({});
      toast.success("Conta desconectada");
      setToken(""); setAccount("");
      await refresh();
    } catch (e: any) { toast.error(e?.message ?? "Falha ao desconectar"); }
    finally { setBusy(false); }
  }

  const connected = status?.connected;

  return (
    <AppShell title="Integrações" subtitle="Conecte ferramentas externas ao Zappfy">
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Card principal */}
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-6 shadow-elegant">
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-[#1877F2]/10 p-3">
              <Facebook className="h-6 w-6 text-[#1877F2]" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">Facebook Ads</h2>
                {connected ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-500">
                    <CheckCircle2 className="h-3 w-3" /> Conectado
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-500">
                    <AlertCircle className="h-3 w-3" /> Não conectado
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Sincronize automaticamente investimento, compras e faturamento das suas campanhas para a aba
                Facebook Ads, Dashboard e DRE.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4">
            <div className="grid gap-1.5">
              <Label className="text-xs">Access Token (System User Token)</Label>
              <Input
                type="password"
                placeholder={connected ? "•••••••• (token salvo)" : "EAA..."}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                autoComplete="off"
              />
              <span className="text-[11px] text-muted-foreground">
                Gere em business.facebook.com → Configurações → Usuários do sistema → Gerar token (permissões: ads_read).
              </span>
            </div>

            <div className="grid gap-1.5">
              <Label className="text-xs">ID da Conta de Anúncio</Label>
              <Input
                placeholder="act_1234567890 ou 1234567890"
                value={account}
                onChange={(e) => setAccount(e.target.value)}
              />
              <span className="text-[11px] text-muted-foreground">
                Você encontra em Gerenciador de Anúncios → topo da página (formato <code>act_XXXXXXXX</code>).
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={handleSave} disabled={busy}>
                <Plug className="mr-2 h-4 w-4" /> {connected ? "Atualizar credenciais" : "Conectar"}
              </Button>
              {connected && (
                <>
                  <Button variant="secondary" onClick={handleSync} disabled={busy}>
                    <RefreshCw className={`mr-2 h-4 w-4 ${busy ? "animate-spin" : ""}`} /> Sincronizar agora
                  </Button>
                  <Button variant="ghost" onClick={handleDisconnect} disabled={busy}>
                    Desconectar
                  </Button>
                </>
              )}
            </div>

            {status && connected && (
              <div className="mt-2 rounded-lg border border-border bg-secondary/30 p-3 text-xs">
                <div>Conta: <span className="font-medium text-foreground">{status.ad_account_id}</span></div>
                <div>
                  Última sincronização:{" "}
                  <span className="font-medium text-foreground">
                    {status.last_sync_at ? new Date(status.last_sync_at).toLocaleString("pt-BR") : "—"}
                  </span>
                  {status.last_sync_status === "ok" && <span className="ml-2 text-emerald-500">OK</span>}
                  {status.last_sync_status === "error" && <span className="ml-2 text-red-500">Erro</span>}
                </div>
                {status.last_sync_error && (
                  <div className="mt-1 text-red-400">{status.last_sync_error}</div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Card de ajuda */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-elegant">
          <h3 className="font-semibold">Como obter o token?</h3>
          <ol className="mt-3 space-y-2 text-sm text-muted-foreground list-decimal pl-4">
            <li>Acesse o Meta Business Manager</li>
            <li>Configurações do Negócio → Usuários do sistema</li>
            <li>Crie um usuário admin e atribua sua conta de anúncio</li>
            <li>Clique em “Gerar novo token” com a permissão <code>ads_read</code></li>
            <li>Cole aqui o token (recomendado: longa duração)</li>
          </ol>
          <a
            href="https://business.facebook.com/settings/system-users"
            target="_blank" rel="noreferrer"
            className="mt-4 inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            Abrir Business Manager <ExternalLink className="h-3 w-3" />
          </a>
          <div className="mt-6 rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
            🔒 O token é armazenado com segurança no banco da sua loja e usado apenas para ler métricas das suas campanhas.
          </div>
        </div>
      </div>
    </AppShell>
  );
}
