

## Plano: Delay mínimo de 5s entre leads

### Alteração

No arquivo `supabase/functions/execute-broadcast/index.ts`, **linha 259**, substituir:

```typescript
const delayMs = (broadcast.delay_between_messages || 10) * 1000;
```

Por:

```typescript
const delayMs = Math.max(5000, (broadcast.delay_between_messages || 10) * 1000);
```

### Arquivo afetado
- `supabase/functions/execute-broadcast/index.ts` — 1 linha editada

Nenhuma outra lógica será alterada.

