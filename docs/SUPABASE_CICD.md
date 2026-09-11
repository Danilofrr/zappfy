# Diagnóstico e reconciliação do histórico de migrations

O workflow `.github/workflows/deploy-supabase-migrations.yml` não faz deploy de
SQL. Ele existe somente para diagnosticar e, com aprovação humana, reconciliar o
histórico de migrations entre o repositório e o projeto Supabase de produção.

## Migration canônica de controle de carga

`20260911203202_741feefa-6a9c-4164-a055-603db781a7a0.sql` é a versão canônica e já
está registrada no histórico remoto. A antiga cópia
`20260911120000_delivery_load_control.sql` diferia apenas pela quebra de linha no
fim do arquivo e foi removida. A versão `20260911120000` não é uma migration
pendente e não deve ser reparada nem executada.

O workflow protege explicitamente as duas versões: o diagnóstico falha se
`20260911203202` não aparecer dos dois lados do histórico, e a reconciliação
recusa tanto `20260911203202` quanto `20260911120000`.

## Modo `diagnose` (sempre primeiro)

Execute manualmente **Actions / Diagnose or reconcile Supabase migration history /
Run workflow**, mantendo o modo padrão `diagnose`. Esse job é read-only em relação
ao banco: executa apenas `supabase migration list --linked`, publica a tabela no
resumo da execução e salva `migration-history.txt` e `divergent-migrations.txt`
como artefato.

Revise o artefato e confirme fora do workflow se cada migration divergente legada
representa SQL que já existe no banco. Não avance em caso de dúvida.

## Modo `reconcile` (somente depois da revisão)

1. Crie o environment `production-migration-reconciliation`, copie nele os três
   secrets descritos abaixo e configure **required reviewers**.
2. Inicie uma nova execução manual no modo `reconcile`.
3. Em `legacy_versions`, informe somente as versões legadas divergentes aprovadas,
   separadas por vírgula.
4. Em `confirmation`, digite exatamente `RECONCILE LEGACY HISTORY`.
5. Revise novamente o resultado do job `diagnose`. Só então aprove o job
   `reconcile` no environment protegido.

A reconciliação só aceita versões numéricas anteriores a `20260911203202` que
continuem divergentes no diagnóstico da própria execução. Para uma versão apenas
local, registra `applied`; para uma versão apenas remota e sem arquivo local,
registra `reverted`. Essas operações alteram apenas o histórico da CLI e nunca
executam o SQL das migrations.

## Garantias de segurança

- não há gatilho automático por `push`;
- `diagnose` é o modo padrão e não altera o histórico remoto;
- `reconcile` depende de um diagnóstico bem-sucedido e de aprovação do environment;
- não existe `supabase db push`, execução de SQL ou reaplicação de migration;
- não existe `supabase db reset`, exclusão ou recriação de dados;
- a migration canônica `20260911203202` nunca é marcada como `reverted`;
- somente versões legadas explicitamente revisadas podem ter o histórico reparado.

## Secrets obrigatórios

Cadastre estes secrets nos environments `production` e
`production-migration-reconciliation`:

| Secret                  | Conteúdo                                                                   |
| ----------------------- | -------------------------------------------------------------------------- |
| `SUPABASE_ACCESS_TOKEN` | Personal access token de **Supabase Dashboard > Account > Access Tokens**. |
| `SUPABASE_DB_PASSWORD`  | Senha do banco do projeto de produção.                                     |
| `SUPABASE_PROJECT_ID`   | Project ref do projeto Supabase de produção.                               |

Não use anon key, service-role key ou connection string nesse fluxo. Nunca tente
resolver divergências de produção com `db reset` ou reaplicando migrations antigas.
