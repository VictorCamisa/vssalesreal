

## Plano: Criar GitHub Actions workflow para automação do pipeline CRM

Criar o arquivo `.github/workflows/pipeline-automation.yml` com o workflow que:
- Roda a cada 10 minutos via cron
- Permite execução manual via `workflow_dispatch`
- Faz `curl POST` para a edge function usando secrets do repositório (`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`)

### Pré-requisito
O usuário precisará configurar dois secrets no repositório GitHub (Settings → Secrets and variables → Actions):
- `SUPABASE_URL` — URL do projeto
- `SUPABASE_SERVICE_ROLE_KEY` — chave service role

### Arquivo a criar
`.github/workflows/pipeline-automation.yml` com o conteúdo exato solicitado.

Nenhum outro arquivo será alterado.

