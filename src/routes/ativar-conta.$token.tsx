import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { activateAccount, getActivationInfo } from "@/lib/activation.functions";
import { ShieldCheck, CheckCircle2 } from "lucide-react";
import { validatePassword, PASSWORD_HINT } from "@/lib/password-policy";

export const Route = createFileRoute("/ativar-conta/$token")({
  ssr: false,
  component: ActivatePage,
});

function ActivatePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [valid, setValid] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getActivationInfo({ data: { token } })
      .then((info: any) => { setEmail(info.email); setValid(true); })
      .catch(() => setValid(false));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const check = validatePassword(password);
    if (!check.ok) return toast.error(check.error);
    if (password !== confirm) return toast.error("As senhas não coincidem");
    setLoading(true);
    try {
      await activateAccount({ data: { token, password } });
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("Conta ativada! Bem-vindo ao Zappfy 🎉");
      navigate({ to: "/" });
    } catch (e: any) {
      toast.error(e.message ?? "Falha na ativação");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-background p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 space-y-5">
        <div className="text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-primary mb-3">
            <ShieldCheck className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">Ativar sua conta Zappfy</h1>
          <p className="text-sm text-muted-foreground mt-1">Crie sua senha de acesso</p>
        </div>
        {valid === false && (
          <div className="text-center text-destructive">Token inválido ou expirado. Solicite um novo link ao administrador.</div>
        )}
        {valid === true && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div><Label>E-mail</Label><Input value={email} disabled /></div>
            <div><Label>Nova senha</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={PASSWORD_HINT} required /></div>
            <div><Label>Confirmar senha</Label><Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required /></div>
            <Button type="submit" disabled={loading} className="w-full">
              <CheckCircle2 className="h-4 w-4 mr-1" /> Ativar conta
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
