

## Plano: Controle de contexto no `ai-whatsapp-hook`

Três alterações cirúrgicas no arquivo `supabase/functions/ai-whatsapp-hook/index.ts`:

### 1. Truncar contexto do system prompt (entre linhas 449-450)

Após construir todos os blocos (`antiHallucinationPrefix`, `scenario.system_prompt`, `behaviorRules`, `broadcastContext`, `companyContext`, `knowledgeContext`, `antiRepetitionReminder`, `antiInjectionGuard`) e ANTES de montar o `systemPrompt` final:

```typescript
// Context size control
const MAX_SYSTEM_PROMPT_CHARS = 6000;
const coreParts = antiHallucinationPrefix + scenario.system_prompt + "\n" + behaviorRules + broadcastContext;
const suffixParts = antiRepetitionReminder + antiInjectionGuard;
const coreSize = coreParts.length + suffixParts.length;
const originalSize = coreSize + companyContext.length + knowledgeContext.length;

let finalKnowledge = knowledgeContext;
let finalCompany = companyContext;

if (originalSize > MAX_SYSTEM_PROMPT_CHARS) {
  // Priority: truncate knowledge first (max 2000), then company (max 1000)
  if (finalKnowledge.length > 2000) finalKnowledge = finalKnowledge.substring(0, 2000) + "\n--- (truncado) ---";
  if (coreSize + finalKnowledge.length + finalCompany.length > MAX_SYSTEM_PROMPT_CHARS && finalCompany.length > 1000) {
    finalCompany = finalCompany.substring(0, 1000) + "\n--- (truncado) ---";
  }
  const finalSize = coreSize + finalKnowledge.length + finalCompany.length;
  console.warn("Context truncated:", { originalSize, finalSize });
}

const systemPrompt = coreParts + finalCompany + finalKnowledge + suffixParts;
```

Substitui a linha 450 atual:
```typescript
const systemPrompt = antiHallucinationPrefix + scenario.system_prompt + "\n" + behaviorRules + broadcastContext + companyContext + knowledgeContext + antiRepetitionReminder + antiInjectionGuard;
```

### 2. Limitar histórico de conversa a 10 mensagens (linha 470)

Alterar `.limit(contextWindow)` para `.limit(10)`:
```typescript
.limit(10);
```

### 3. Nenhuma outra lógica alterada

- `behaviorRules`, `antiHallucinationPrefix`, `antiRepetitionReminder`, `antiInjectionGuard` nunca são cortados
- `broadcastContext` é mantido no core (geralmente curto e contextualmente crítico)
- A chamada à API Anthropic permanece idêntica

