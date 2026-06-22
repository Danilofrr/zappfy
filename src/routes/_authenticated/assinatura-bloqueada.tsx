import { createFileRoute, Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { whatsappLink } from "@/lib/tracking";

export const Route = createFileRoute("/_authenticated/assinatura-bloqueada")({
  component: BlockedPage,
});

function BlockedPage() {
  return (
    <div className="min-h-screen grid place-items-center bg-background p-6">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-destructive/15">
          <Lock className="h-8 w-8 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold">Sua assinatura está vencida</h1>
        <p className="text-muted-foreground">Para continuar usando o Zappfy, entre em contato para renovar sua assinatura.</p>
        <div className="flex gap-2 justify-center">
          <Button asChild>
            <a href={whatsappLink("", "Olá! Preciso de ajuda para renovar minha assinatura.")} target="_blank" rel="noopener noreferrer">Falar com o suporte</a>
          </Button>
          <Button variant="outline" onClick={async () => { await supabase.auth.signOut(); window.location.href = "/auth"; }}>Sair</Button>
        </div>
      </div>
    </div>
  );
}
