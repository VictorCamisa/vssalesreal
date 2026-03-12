

## Plano: Criar tabela `integration_instances` e otimizar lookup no webhook

### 1. Migration SQL

Criar a tabela, popular com dados existentes, e habilitar RLS:

```sql
-- Tabela dedicada
CREATE TABLE public.integration_instances (
  instance_name TEXT PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id),
  integration_id UUID NOT NULL REFERENCES integrations(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.integration_instances ENABLE ROW LEVEL SECURITY;

-- Policy: service role pode inserir (usado pelo webhook e pela gestão de instâncias)
CREATE POLICY "Service can insert instances" ON public.integration_instances
  FOR INSERT TO public WITH CHECK (true);

-- Policy: org members podem ver suas instâncias
CREATE POLICY "Org members can view instances" ON public.integration_instances
  FOR SELECT TO public USING (is_org_member(org_id));

-- Popular a partir de instances_by_user
INSERT INTO public.integration_instances (instance_name, org_id, integration_id)
SELECT DISTINCT inst.instance_name, i.org_id, i.id
FROM public.integrations i,
LATERAL (
  SELECT jsonb_array_elements_text(value) AS instance_name
  FROM jsonb_each(i.config->'instances_by_user')
) inst
WHERE i.service_name = 'evolution'
  AND inst.instance_name IS NOT NULL AND inst.instance_name != ''
ON CONFLICT (instance_name) DO NOTHING;

-- Popular a partir do array flat 'instances'
INSERT INTO public.integration_instances (instance_name, org_id, integration_id)
SELECT DISTINCT
  jsonb_array_elements_text(i.config->'instances') AS instance_name,
  i.org_id, i.id
FROM public.integrations i
WHERE i.service_name = 'evolution'
  AND i.config->'instances' IS NOT NULL
ON CONFLICT (instance_name) DO NOTHING;
```

### 2. Alteração em `supabase/functions/ai-whatsapp-hook/index.ts` (linhas 50-60)

**Antes** — SELECT * + loop em memória:
```typescript
const { data: integrations } = await supabaseAdmin.from("integrations").select("*").eq("service_name", "evolution");
let orgId: string | null = null;
for (const integ of integrations || []) { ... }
```

**Depois** — query direta na nova tabela:
```typescript
const { data: instRow } = await supabaseAdmin
  .from("integration_instances")
  .select("org_id")
  .eq("instance_name", instanceName)
  .maybeSingle();
const orgId = instRow?.org_id || null;
```

### Resumo
- 1 migration (tabela + RLS + população de dados existentes)
- 1 arquivo editado, 1 trecho substituído (linhas 50-60)
- Nenhuma outra lógica alterada

