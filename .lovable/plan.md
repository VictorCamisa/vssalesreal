

## Plano: Migrar AgentSimulator de ai_configs para ai_scenarios

### Alterações em `src/components/ai/AgentSimulator.tsx`

**1. Estado e tipo dos agentes (linhas 157-158):**
- `selectedAgent` passa a armazenar `scenario_key` em vez de `id`
- `agents` muda de `{ id, role, instance }` para `{ scenario_key, name }`

**2. Query (linhas 165-178):**
```typescript
supabase
  .from("ai_scenarios")
  .select("scenario_key, name")
  .eq("org_id", orgId)
  .eq("enabled", true)
```
Mapear para `{ scenario_key, name }`, selecionar primeiro por default.

**3. Body da request (linha 252):**
```typescript
{ messages: finalMsgs, scenario_key: selectedAgent }
```

**4. Dropdown e header (linhas 316-319, 437):**
- `SelectItem` usa `a.scenario_key` como key/value, exibe `a.name`
- Header exibe `agents.find(a => a.scenario_key === selectedAgent)?.name`

### Resumo
- 1 arquivo, 4 trechos editados
- Nenhuma outra lógica alterada

