

## Plano: Migrar ai-follow-up de ai_configs para ai_scenarios

### Análise

A função atual filtra conversas por `ai_config_id` (linha 29), busca configs da tabela `ai_configs` (linhas 70-78), e usa `aiConfig.system_prompt`, `aiConfig.temperature`, e `aiConfig.enabled`.

A tabela `ai_scenarios` não possui coluna `agent_name` — apenas `system_prompt`, `temperature`, `enabled`, `scenario_key`, `org_id`, `behavior`, `name`, `description`. A referência será feita via `scenario_key` + `org_id` (campos já existentes em `conversation_tracker`).

### Alterações no arquivo `supabase/functions/ai-follow-up/index.ts`

**1. Filtro de conversas (linha 25-29):** Trocar `.not("ai_config_id", "is", null)` por `.not("scenario_key", "is", null)` — usar `scenario_key` como critério.

**2. Busca de regras (linhas 42-62):** As follow_up_rules ainda referenciam `ai_config_id`. Manter essa lógica como está (só filtra regras, não muda a fonte do prompt).

**3. Busca de AI config (linhas 69-78):** Substituir query em `ai_configs` por query em `ai_scenarios`, usando `org_id` + `scenario_key` das conversas encontradas. Indexar por `org_id + scenario_key`.

**4. Referência ao config (linha 122-123):** Trocar `aiConfigById[conv.ai_config_id]` por lookup usando `conv.org_id` + `conv.scenario_key`.

**5. Uso do config (linhas 143, 178):** Mapear campos equivalentes:
- `aiConfig.system_prompt` → `scenario.system_prompt`
- `aiConfig.temperature` → `scenario.temperature`
- `aiConfig.enabled` → `scenario.enabled`

**6. Se não encontrar cenário ativo:** Pular a conversa (continue), sem fallback.

### Arquivo afetado
- `supabase/functions/ai-follow-up/index.ts` — ~5 trechos editados
- Nenhuma migration necessária

