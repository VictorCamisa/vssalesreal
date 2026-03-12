

## Plano: Delay proporcional ao tamanho do bloco

### Alteração

No arquivo `supabase/functions/execute-broadcast/index.ts`, linhas 238-242, substituir o cálculo de delay atual:

```
const baseDelay = 1000 + Math.random() * 2000;
const lengthBonus = Math.min(blocks[i].length * 10, 1000);
await new Promise(resolve => setTimeout(resolve, baseDelay + lengthBonus));
```

Por:

```
const baseDelay = Math.max(3000, blocks[i].length * 50);
await new Promise(resolve => setTimeout(resolve, baseDelay));
```

### Arquivo afetado
- `supabase/functions/execute-broadcast/index.ts` — linhas 239-241

Nenhuma outra lógica será alterada.

