import React from "react";
import { AlertTriangle } from "lucide-react";

type Props = { children: React.ReactNode; title?: string };
type State = { error: Error | null };

/**
 * Impede que um erro dentro de um formulário/diálogo derrube a página inteira.
 * Mostra uma mensagem clara no lugar do conteúdo quebrado.
 */
export class FormErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error("[FormErrorBoundary]", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm space-y-2">
          <div className="flex items-center gap-2 font-semibold text-destructive">
            <AlertTriangle className="h-4 w-4" />
            {this.props.title ?? "Não foi possível carregar este formulário"}
          </div>
          <p className="text-muted-foreground text-xs">
            {this.state.error.message || "Erro inesperado."}
          </p>
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="text-xs font-medium underline text-primary"
          >
            Tentar novamente
          </button>
        </div>
      );
    }
    return this.props.children as React.ReactElement;
  }
}
