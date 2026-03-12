

## Plano: Sincronizar `integration_instances` no manage-evolution

### Alterações em `supabase/functions/manage-evolution/index.ts`

**3 pontos de inserção/deleção:**

#### 1. Após criação (linha 127, depois de `setUserInstances`)
```typescript
// Sync integration_instances table
await supabaseAdmin
  .from("integration_instances")
  .insert({ instance_name, org_id, integration_id: integration!.id })
  .select();
```
Nota: Supabase JS client não tem `.onConflict().ignore()`. Usaremos upsert ou ignoraremos o erro de conflito silenciosamente.

#### 2. No fluxo de deleção — caso 404 (linha 285, depois de `setUserInstances`)
```typescript
await supabaseAdmin
  .from("integration_instances")
  .delete()
  .eq("instance_name", instance_name);
```

#### 3. No fluxo de deleção — caso sucesso (linha 292, depois de `setUserInstances`)
```typescript
await supabaseAdmin
  .from("integration_instances")
  .delete()
  .eq("instance_name", instance_name);
```

### Resumo
- 1 arquivo editado (`manage-evolution/index.ts`)
- 3 trechos adicionados (1 upsert na criação, 2 deletes na remoção)
- Nenhuma outra lógica alterada

