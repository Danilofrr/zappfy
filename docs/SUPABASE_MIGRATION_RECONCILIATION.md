# Reconciliação única do histórico de migrations

## Estado conhecido e conclusão da análise local

Esta análise é deliberadamente independente do banco remoto, ao qual o ambiente de
desenvolvimento não tem acesso. Foram lidos os **94 arquivos / 5.651 linhas SQL**
que existiam quando o erro foi investigado. O inventário encontrou:

- uma cadeia legada com 92 migrations, de `20260617001946` até
  `20260911010112`;
- a migration que deve permanecer pendente,
  `20260911120000_delivery_load_control.sql`;
- `20260911203202_741feefa-6a9c-4164-a055-603db781a7a0.sql`, uma cópia de conteúdo da migration pendente; a única diferença era a quebra de
  linha final.

A cópia `20260911203202` foi removida. Mantê-la faria o próximo `db push`
registrar e tentar executar duas vezes a mesma mudança. O baseline reconciliável
passa a ter 92 arquivos e está congelado, arquivo por arquivo, em
`supabase/legacy-migrations.sha256`. O workflow recusa a operação se faltar um
arquivo, se houver arquivo legado extra ou se um único byte desse conjunto mudar.

A leitura de todos os SQLs também mostra por que **não é seguro reaplicá-los**:

- a primeira migration cria as tabelas-base sem `IF NOT EXISTS`;
- há DML histórico que altera `settings`, `orders`, `products` e `subscriptions`;
- há substituições de views, policies, triggers e funções;
- migrations criam funções administrativas que contêm `DELETE`, inclusive rotinas
  de remoção de loja e motoboy (essas exclusões estão no corpo das funções, mas
  reforçam que não se deve usar uma busca textual como autorização para replay);
- a cadeia alcança `public`, além de policies sobre `storage.objects` e referências
  a `auth` e extensões.

Portanto, nenhum SQL legado será executado em produção durante a reconciliação.

## Referências e escolha do método

O procedimento segue o modelo oficial da CLI:

- [`migration list`](https://supabase.com/docs/reference/cli/supabase-migration-list)
  é a fonte para comparar as versões local e remota;
- [`migration repair`](https://supabase.com/docs/reference/cli/supabase-migration-repair)
  altera os registros de `supabase_migrations.schema_migrations`, sem executar o
  conteúdo SQL da migration;
- [`db pull`](https://supabase.com/docs/reference/cli/supabase-db-pull) é útil para
  criar uma migration a partir do schema remoto quando o remoto é a fonte de
  verdade.

Não usamos `db pull` automaticamente aqui. Em um repositório que já tem uma cadeia
completa, aceitar um snapshot novo sem provar a equivalência esconderia diferenças
e criaria um segundo baseline. Em vez disso, `db dump` guarda no artefato uma
fotografia somente de schema, e `db diff --linked` reconstrói os 92 SQLs legados em
um banco shadow e exige diferença vazia contra `auth,extensions,public,storage`. Isso testa a cadeia
existente sem executá-la em produção. Se a diferença não for vazia, o workflow
para; o artefato deve ser analisado e então pode-se optar, em outro PR, por um
baseline produzido com `db pull`.

> Equivalência de schema não prova que DML histórico aconteceu. Ela prova a
> condição necessária para uma reconciliação **somente de histórico**. Como o
> objetivo é preservar os dados atuais, o DML antigo não é repetido nem revertido.

## Plano obrigatório antes de qualquer alteração

O workflow `Reconcile Supabase migration history` sempre imprime este plano antes
de poder chamar `migration repair`:

1. validar os três secrets, a quantidade de arquivos e todos os hashes do baseline;
2. executar `migration list --linked` e arquivar a tabela completa;
3. capturar o schema remoto com `db dump` (sem dados);
4. retirar **somente no runner** a migration `20260911120000`, reconstruir a cadeia
   legada em shadow e comparar com produção;
5. abortar sem reparo se houver qualquer diferença em `auth`, `extensions`, `public` ou `storage`;
6. no modo `diagnose`, encerrar sempre sem alteração remota;
7. somente no modo `reconcile` e com a confirmação literal
   `RECONCILE_HISTORY_ONLY`, marcar versões apenas-remotas como `reverted` e as
   versões legadas apenas-locais como `applied`;
8. consultar o histórico novamente, exigir que não reste versão apenas-remota e
   que `20260911120000` seja a única apenas-local;
9. executar apenas `supabase db push --linked --dry-run` e conferir que ele propõe
   `20260911120000`.

O passo 7 altera **somente** `supabase_migrations.schema_migrations`. `reverted`
nesse contexto não desfaz objetos e `applied` não roda SQL. Não há `db reset`,
`DROP TABLE`, exclusão de dados, restauração, recriação ou `db push` efetivo nesse
workflow.

## Operação em duas aprovações

1. Revisar e fazer merge deste PR manualmente. O push pode fazer o deploy normal
   falhar novamente; isso é esperado e não altera o banco.
2. Em **Actions > Reconcile Supabase migration history**, escolher `diagnose`.
3. Baixar o artefato `supabase-reconciliation-diagnose-*` e revisar:
   `migration-list-before.txt`, `remote-only-before.txt`,
   `local-only-before.txt`, `remote-schema.sql`, todos os hashes e o diff vazio.
4. Se o diff não for vazio ou o inventário remoto não fizer sentido, **parar**. Não
   executar `reconcile`; investigar o diff e considerar um baseline via `db pull`
   em outro PR.
5. Com a evidência revisada, executar novamente escolhendo `reconcile` e digitando
   `RECONCILE_HISTORY_ONLY`. Recomenda-se required reviewer no environment
   `production` para constituir a segunda aprovação.
6. Baixar o novo artefato e confirmar que o dry-run lista somente
   `20260911120000`.
7. Só então executar manualmente o workflow normal `Deploy Supabase migrations`.
   Ele continuará usando `supabase db push --linked` e será o único fluxo que
   efetivamente aplicará a migration pendente.

## Falhas e recuperação

Uma falha antes de `migration repair` não muda o histórico. Se a CLI falhar no meio
do reparo, não execute o deploy normal: use os arquivos `migration-list-before` e
`migration-list-after` do artefato para identificar exatamente o subconjunto
alterado. Somente essas versões podem receber o status inverso, após revisão
humana. Depois, repita primeiro o modo `diagnose`. Nunca derive comandos de reparo
de memória ou apenas da mensagem de erro.
