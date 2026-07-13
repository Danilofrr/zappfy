import { useState } from "react";
import { Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

const MIN_LEN = 8;

export function ChangePasswordCard() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const [needsCode, setNeedsCode] = useState(false);
  const [code, setCode] = useState("");

  const lenOk = newPassword.length >= MIN_LEN;
  const matchOk = newPassword.length > 0 && newPassword === confirmPassword;

  function reset() {
    setNewPassword("");
    setConfirmPassword("");
    setCode("");
    setShowNew(false);
    setShowConfirm(false);
    setNeedsCode(false);
  }

  async function doUpdate(nonce?: string) {
    const payload: { password: string; nonce?: string } = { password: newPassword };
    if (nonce) payload.nonce = nonce;
    const { error } = await supabase.auth.updateUser(payload);
    if (error) throw error;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    try {
      setLoading(true);

      if (needsCode) {
        if (!code.trim()) throw new Error("Informe o código de confirmação enviado ao seu e-mail.");
        await doUpdate(code.trim());
        toast.success("Senha alterada com sucesso.");
        reset();
        return;
      }

      if (!newPassword || !confirmPassword) throw new Error("Preencha a nova senha e a confirmação.");
      if (newPassword.trim().length === 0) throw new Error("A nova senha não pode conter somente espaços.");
      if (newPassword.length < MIN_LEN) throw new Error(`A nova senha deve possuir no mínimo ${MIN_LEN} caracteres.`);
      if (newPassword !== confirmPassword) throw new Error("As senhas informadas não são iguais.");

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("Sua sessão expirou. Entre novamente para alterar sua senha.");

      try {
        await doUpdate();
        toast.success("Senha alterada com sucesso.");
        reset();
      } catch (err: any) {
        const code = String(err?.code ?? "");
        const msg = String(err?.message ?? "");
        if (code === "reauthentication_needed" || /reauthenticat/i.test(msg)) {
          const { error: rErr } = await supabase.auth.reauthenticate();
          if (rErr) throw rErr;
          setNeedsCode(true);
          toast.info("Enviamos um código de confirmação para o seu e-mail.");
          return;
        }
        throw err;
      }
    } catch (error: any) {
      console.error("Erro ao alterar senha");
      const msg = error instanceof Error ? error.message : "Não foi possível alterar a senha. Tente novamente.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 lg:p-6 card-neon">
      <div className="flex items-center gap-3 mb-4">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 ring-1 ring-primary/20 shrink-0">
          <ShieldCheck className="h-4 w-4 text-primary" />
        </div>
        <div>
          <div className="text-sm font-semibold">Segurança</div>
          <p className="text-xs text-muted-foreground">Altere a senha utilizada para acessar sua conta.</p>
        </div>
      </div>


      <form onSubmit={handleSubmit} className="grid gap-3">
        {!needsCode && (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs">Nova senha</Label>
              <div className="relative">
                <Input
                  type={showNew ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  disabled={loading}
                  style={{ fontSize: 16, minHeight: 44 }}
                  className="pr-11"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowNew((v) => !v)}
                  aria-label={showNew ? "Ocultar senha" : "Mostrar senha"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
                >
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">A senha deve possuir no mínimo {MIN_LEN} caracteres.</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Confirmar nova senha</Label>
              <div className="relative">
                <Input
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  disabled={loading}
                  style={{ fontSize: 16, minHeight: 44 }}
                  className="pr-11"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  aria-label={showConfirm ? "Ocultar senha" : "Mostrar senha"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
                <span className={lenOk ? "text-emerald-500" : "text-muted-foreground"}>
                  {lenOk ? "✓" : "•"} Mínimo de {MIN_LEN} caracteres
                </span>
                <span className={matchOk ? "text-emerald-500" : "text-muted-foreground"}>
                  {matchOk ? "✓" : "•"} As duas senhas são iguais
                </span>
              </div>
            </div>
          </>
        )}

        {needsCode && (
          <div className="space-y-1.5">
            <Label className="text-xs">Código de confirmação</Label>
            <Input
              type="text"
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={loading}
              style={{ fontSize: 16, minHeight: 44 }}
              placeholder="Digite o código enviado ao seu e-mail"
              autoComplete="one-time-code"
            />
            <p className="text-[11px] text-muted-foreground">
              Enviamos um código de confirmação para o seu e-mail.
            </p>
          </div>
        )}

        <div className="flex items-center gap-2 pt-1">
          <Button type="submit" disabled={loading} style={{ minHeight: 44 }}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {loading
              ? (needsCode ? "Confirmando..." : "Alterando senha...")
              : (needsCode ? "Confirmar e alterar senha" : "Alterar senha")}
          </Button>
          {needsCode && !loading && (
            <Button type="button" variant="ghost" onClick={reset}>Cancelar</Button>
          )}
        </div>
      </form>
    </div>
  );
}
