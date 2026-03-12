

## Plano: Unificar pipeline usando `stage_key` como fonte de verdade

### 1. Frontend — `src/pages/CRM.tsx`

**1a. Type `Stage` (linha 130):** Adicionar `stage_key`
```typescript
type Stage = { id: string; name: string; stage_order: number; stage_key: string | null };
```

**1b. Query de stages:** Adicionar `stage_key` no select (buscar onde faz `.select("id, name, stage_order")`)

**1c. `stageMap` (linhas 315-323):** Substituir lookup por nome por lookup por `stage_key`:
```typescript
const stageMap = useMemo(() => {
  const map = new Map<string, typeof PIPELINE_STAGES[0]>();
  stages.forEach((s) => {
    const def = PIPELINE_STAGES.find(p => p.key === s.stage_key);
    if (def) map.set(s.id, def);
  });
  return map;
}, [stages]);
```

### 2. Edge Function — `crm-pipeline-automation/index.ts`

**2a. Remover** `PIPELINE_STAGES` (linhas 9-19) e `STAGE_ALIASES` (linhas 60-70)

**2b. Substituir** a query de stages (linha 44-48) para incluir `stage_key`:
```typescript
const { data: stages } = await supabase
  .from("crm_stages")
  .select("id, name, stage_order, stage_key")
  .eq("org_id", orgId)
  .order("stage_order");
```

**2c. Substituir** `stageByName` + `findStageId()` (linhas 52-86) por lookup direto por `stage_key`:
```typescript
const stageByKey = new Map<string, string>();
for (const s of stages) {
  if (s.stage_key) stageByKey.set(s.stage_key, s.id);
}

const findStageId = (key: string): string | null => stageByKey.get(key) || null;
```

As 6 chamadas `findStageId("lead")`, `findStageId("enriched")`, etc. (linhas 88-93) continuam funcionando sem alteração.

### O que NÃO muda
- Metadata visual no frontend (ícones, cores, roles, aiTemplate) — permanece no array `PIPELINE_STAGES`
- Toda lógica de automação de stages 1-5 na edge function
- Funções `deepEnrichLead`, `generatePersonalizedMessage`, `sendWhatsAppMessage`, etc.

