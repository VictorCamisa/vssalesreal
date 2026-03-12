

# Plano de Correções — 4 Tarefas

## Tarefa 1: CORS multi-origem em `scrape-leads` e `ai-follow-up`

Substituir o header CORS estático por lógica de múltiplas origens conforme especificado:

**`supabase/functions/scrape-leads/index.ts`** (linhas 3-7):
- Adicionar lógica de `allowedOrigins` com produção + `ALLOWED_ORIGIN`
- Usar `corsOrigin` dinâmico no header
- A função `json()` (linha 9-10) também precisa usar o corsOrigin dinâmico — será refatorada para receber o origin ou usar variável de escopo

**`supabase/functions/ai-follow-up/index.ts`** (linhas 5-9):
- Mesma lógica de origens múltiplas
- OPTIONS handler (linha 12) precisa usar corsOrigin

## Tarefa 2: Corrigir mensagens cortadas em `execute-broadcast`

**`supabase/functions/execute-broadcast/index.ts`**:

- **Linha 124**: Mudar default de `maxCharsPerBlock` de `200` → `500`
- **Linha 198**: Atualizar o prompt de formato para refletir o novo limite
- **Linhas 205-212**: Reordenar modelos — `claude-3-5-haiku-20241022` primeiro, remover `claude-haiku-3-5-20251001` (inexistente)
- **Linhas 270-277**: Melhorar truncamento para cortar em final de frase (`.`, `!`, `?`) antes de cortar em espaço

## Tarefa 3: Corrigir versão supabase-js no `execute-broadcast`

**Linha 1**: Fixar import para `@2.49.0`:
```
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";
```

Adicionalmente, fallback `getClaims` → `getUser` (linhas 41-43) para resiliência.

## Tarefa 4: Aumentar PROFILE_TIMEOUT_MS

**`src/contexts/AuthContext.tsx`** (linha 33):
- `PROFILE_TIMEOUT_MS` de `8000` → `15000`

---

**Total: 4 arquivos editados, 4 tarefas.**

