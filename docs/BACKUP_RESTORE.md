# Backup e Restauração — Zappfy

Documento operacional. Mantenha atualizado sempre que mudar infraestrutura de
dados, retenção ou pessoas responsáveis.

---

## 1. Visão geral

| Item | Onde fica | Quem mantém | Retenção |
|---|---|---|---|
| Banco Postgres (todas as tabelas `public.*`) | Supabase managed backups | Supabase | Diário (Free: 7d sem PITR / Pro: 7d com PITR) |
| `auth.users` (credenciais) | Schema `auth` do Supabase | Supabase | Mesma janela acima |
| Logs de webhook (`kiwify_webhook_logs`) | Tabela Postgres | App (cron) | 90 dias |
| Logs de acesso (`access_logs`) | Tabela Postgres | App (cron) | 180 dias |
| Imagens de produtos/loja | URLs externas hospedadas pelos próprios lojistas | Lojista | N/A |
| Secrets (chaves, tokens) | Supabase Vault / Lovable Secrets | Admin Zappfy | Indefinido |

> **Importante:** o projeto **não usa Supabase Storage**. Não há buckets a
> serem incluídos no backup.

---

## 2. Objetivos de recuperação (SLO)

| Métrica | Meta | Como atingimos |
|---|---|---|
| **RPO** (perda máxima aceitável) | ≤ 24 horas | Backup diário Supabase + (futuro) export semanal off-site |
| **RTO** (tempo máximo de restauração) | ≤ 4 horas | Restore via painel Supabase + DNS já apontado |

---

## 3. Backups automáticos

### 3.1 Supabase (principal)

O Supabase faz snapshots automáticos diários do banco inteiro. Para verificar:

1. Acesse https://supabase.com/dashboard/project/czoekxxxxdbxclmpmlya/database/backups
2. Confirme se há snapshots dos últimos 7 dias.
3. **Recomendado:** ativar Point-in-Time Recovery (PITR) em Settings → Add-ons.
   Sem PITR só é possível restaurar para o snapshot diário; com PITR,
   restaura para qualquer segundo dentro da janela.

### 3.2 Limpeza de logs antigos (pg_cron)

Migration aplicada em `20260624XXXXXX_log_retention.sql`:

- `kiwify_webhook_logs` → linhas > 90 dias são apagadas diariamente às 03:00 UTC.
- `access_logs` → linhas > 180 dias são apagadas diariamente às 03:15 UTC.

Para inspecionar:

```sql
SELECT jobname, schedule, active FROM cron.job;
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;
```

---

## 4. Procedimento de restauração

### 4.1 Restaurar o banco inteiro (cenário: drop acidental, corrupção, ransomware)

1. **Pare a aplicação** (pause cron jobs e bloqueie escritas se possível).
2. Vá em https://supabase.com/dashboard/project/czoekxxxxdbxclmpmlya/database/backups
3. Escolha o snapshot mais recente **anterior** ao incidente.
4. Clique em **Restore** e confirme. O Supabase cria um restore _in-place_ ou
   em um novo projeto (preferível: novo projeto para não destruir evidência).
5. Se um novo projeto foi criado: atualize as variáveis de ambiente
   `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` e re-deploy.
6. Valide com checklist do item 6 antes de liberar tráfego.

### 4.2 Restaurar uma única tabela ou linha

1. Crie um projeto Supabase temporário com o backup (passos 1-4 acima).
2. Conecte-se via `psql` ou Supabase SQL Editor.
3. `pg_dump` da tabela específica:
   ```bash
   pg_dump "postgres://...projeto-temp..." \
     --data-only --table=public.orders > orders_restore.sql
   ```
4. Importe no projeto de produção:
   ```bash
   psql "postgres://...produção..." < orders_restore.sql
   ```
5. Use `INSERT ... ON CONFLICT DO UPDATE` se precisar mesclar com dados novos.

### 4.3 Restaurar usuário do `auth.users`

`auth.users` não é alterável diretamente. Em caso de exclusão acidental:
1. Abra ticket no suporte Supabase (Pro+ tem SLA).
2. Forneça `user_id` ou e-mail e o timestamp aproximado.

---

## 5. Responsáveis

| Papel | Responsabilidade | Contato |
|---|---|---|
| Admin Zappfy | Decide restore, executa procedimento | _preencher_ |
| Suporte Supabase | Restore PITR, recuperação `auth` | https://supabase.com/dashboard/support |
| Desenvolvedor on-call | Validar app após restore | _preencher_ |

---

## 6. Checklist pós-restauração

- [ ] Login de cliente funciona (`/auth`)
- [ ] Login de motoboy funciona (`/m/<slug>`)
- [ ] Checkout público processa pedido (`/c/<slug>`)
- [ ] Webhook Kiwify responde 200 em `/api/public/kiwify-webhook`
- [ ] Painel admin lista clientes (`/admin`)
- [ ] Rastreamento público abre (`/r/<code>`)
- [ ] Cron jobs ativos (`SELECT * FROM cron.job WHERE active = true`)
- [ ] Contagem de linhas das tabelas críticas bate com o esperado:
  - `orders`, `products`, `settings`, `couriers`, `subscriptions`

---

## 7. Teste de restauração

**Frequência mínima:** trimestral.

1. Crie projeto Supabase temporário a partir de um snapshot recente.
2. Aponte uma cópia do app (preview) para o projeto temporário.
3. Execute o checklist do item 6.
4. Registre data, duração e problemas encontrados em `docs/restore-drills.md`.
5. Destrua o projeto temporário.

> Backup que nunca foi testado é equivalente a não ter backup.

---

## 8. Melhorias planejadas

- [ ] Export semanal das tabelas críticas para storage externo (S3/R2/B2)
- [ ] Botão admin "Exportar todos os dados (ZIP)" para portabilidade LGPD
- [ ] Alerta automático se um cron job de retenção falhar 2x seguidas
- [ ] Documento de plano de continuidade (BCP) cobrindo indisponibilidade
      prolongada do Supabase

---

_Última revisão: 2026-06-24_
