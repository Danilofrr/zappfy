# Deploy de migrations do Supabase

O Lovable pode continuar sendo usado como preview da aplicação, mas o deploy do
schema de produção é responsabilidade do workflow
`.github/workflows/deploy-supabase-migrations.yml`.

## Como o deploy funciona

O workflow pode ser iniciado de duas formas:

- automaticamente, por um `push` na branch `main` que altere algum arquivo em
  `supabase/migrations/**`;
- manualmente, por **Actions > Deploy Supabase migrations > Run workflow**, para
  aplicar migrations que já estejam na `main`.

O job somente aceita execuções cujo ref seja a branch `main`, inclusive no disparo
manual. Ele:

1. instala a Supabase CLI com a action oficial;
2. vincula a CLI ao projeto de produção;
3. exibe a tabela de migrations locais e remotas antes do deploy;
4. executa `supabase db push --linked`, que aplica somente as migrations locais
   ainda ausentes no histórico remoto;
5. exibe novamente a tabela de migrations, deixando registrado no log o estado
   aplicado.

Os deploys são serializados por `concurrency`, sem cancelar uma execução em
andamento. Se o vínculo, a consulta do histórico ou uma migration falhar, o job
termina com erro e os passos seguintes não são executados. O workflow não contém
comandos de reset, remoção ou recriação do banco.

> Migrations são código de produção: antes do merge, revise cada SQL para garantir
> que ele próprio não contém operações destrutivas. A automação não transforma uma
> migration destrutiva em uma migration segura.

## Secrets obrigatórios

No GitHub, abra **Settings > Environments > production**, crie o environment
`production` e cadastre nele exatamente estes três secrets:

| Secret                  | Conteúdo                                                                                            |
| ----------------------- | --------------------------------------------------------------------------------------------------- |
| `SUPABASE_ACCESS_TOKEN` | Personal access token criado em **Supabase Dashboard > Account > Access Tokens**.                   |
| `SUPABASE_DB_PASSWORD`  | Senha do banco do projeto de produção.                                                              |
| `SUPABASE_PROJECT_ID`   | Project ref do projeto Supabase de produção (o identificador exibido nas configurações do projeto). |

O project ref não é uma credencial por si só, mas é mantido no environment para
que o destino de produção seja configurado no GitHub e não no workflow. Não use a
anon key, a service-role key nem uma connection string nesse fluxo.

Opcionalmente, configure **required reviewers** no environment `production` para
exigir aprovação humana do job depois do merge. Os secrets do environment só são
liberados para o runner após as regras de proteção serem satisfeitas.

## Primeiro deploy

Antes de incorporar o PR que habilita o workflow:

1. confirme que o `SUPABASE_PROJECT_ID` pertence ao projeto de produção correto;
2. cadastre os três secrets no environment `production`;
3. confira se o histórico remoto de migrations corresponde aos arquivos já
   versionados em `supabase/migrations`;
4. depois que este workflow estiver na `main`, abra **Actions > Deploy Supabase
   migrations > Run workflow**, selecione a branch `main` e confirme a execução
   para aplicar as migrations pendentes que já estavam versionadas;
5. acompanhe o job na aba Actions. As próximas alterações em migrations serão
   executadas automaticamente quando incorporadas à `main`.

Se o histórico local e remoto divergir, o deploy deve permanecer com falha. Corrija
explicitamente o histórico com o procedimento de reparo da Supabase CLI após
validar o estado real do banco; não use `db reset` em produção.

## Reconciliação excepcional do histórico legado

O procedimento único, com diagnóstico somente leitura, prova de equivalência,
dupla confirmação e artefatos de auditoria está documentado em
[`SUPABASE_MIGRATION_RECONCILIATION.md`](SUPABASE_MIGRATION_RECONCILIATION.md).
Não tente contornar o erro com `--include-all`: migrations legadas têm DML e não
podem ser executadas novamente. Depois da reconciliação, este workflow normal
continua sendo o único responsável por executar `supabase db push --linked`.
