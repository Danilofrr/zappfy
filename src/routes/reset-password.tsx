import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { TrendingUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ThemeToggle } from "@/lib/theme";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Redefinir senha — ZappFy" },
      { name: "description", content: "Defina uma nova senha para sua conta ZappFy." },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Supabase parses the recovery token from the URL hash and emits PASSWORD_RECOVERY.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });

    // If the user lands here without a recovery hash, check for an existing session.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
      else {
        // give supabase a moment to consume the hash
        setTimeout(() => {
          supabase.auth.getSession().then(({ data: d2 }) => {
            if (d2.session) setReady(true);
            else setError("Link inválido ou expirado. Solicite uma nova recuperação de senha.");
          });
        }, 800);
      }
    });

    return () => { sub.subscription.unsubscribe(); };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) { toast.error("A senha deve ter pelo menos 6 caracteres"); return; }
    if (password !== confirm) { toast.error("As senhas não coincidem"); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Senha redefinida com sucesso!");
      await supabase.auth.signOut();
      navigate({ to: "/auth" });
    } catch (err: any) {
      toast.error(err?.message ?? "Não foi possível redefinir a senha");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-background px-4 py-8">
      <div className="absolute top-4 right-4"><ThemeToggle /></div>
      <Card className="w-full max-w-md p-6 lg:p-8">
        <div className="flex items-center gap-2 mb-6">
          <div className="h-10 w-10 rounded-lg bg-primary/15 grid place-items-center">
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>
          <span className="text-xl font-bold tracking-tight text-neon">ZappFy</span>
        </div>

        <h1 className="text-2xl font-bold mb-1">Redefinir senha</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Escolha uma nova senha para acessar sua conta.
        </p>

        {error ? (
          <div className="space-y-4">
            <p className="text-sm text-destructive">{error}</p>
            <Button asChild className="w-full">
              <Link to="/auth">Voltar para o login</Link>
            </Button>
          </div>
        ) : !ready ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Validando link...
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="password">Nova senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                required
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm">Confirmar senha</Label>
              <Input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Digite novamente"
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</> : "Redefinir senha"}
            </Button>
            <div className="text-center">
              <Link to="/auth" className="text-xs text-muted-foreground hover:text-foreground underline">
                Voltar para o login
              </Link>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
