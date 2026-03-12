

## Plano: Migrar chamadas AI do gateway Lovable para Anthropic API direta

### Pré-requisito: Secret ANTHROPIC_API_KEY

O secret `ANTHROPIC_API_KEY` **não existe** no projeto. Preciso adicioná-lo antes de implementar as mudanças.

### Diferenças de formato OpenAI → Anthropic

A Anthropic API tem formato diferente do OpenAI-compatible gateway:

```text
OpenAI (atual):
  POST /v1/chat/completions
  Authorization: Bearer {key}
  { model, messages: [{role:"system",...}, ...], temperature }
  Response: choices[0].message.content

Anthropic (novo):
  POST /v1/messages
  x-api-key: {key}
  anthropic-version: 2023-06-01
  { model, system: "...", messages: [...sem system...], max_tokens, temperature }
  Response: content[0].text
```

### Alterações por arquivo

**1. `supabase/functions/ai-whatsapp-hook/index.ts`**
- Linha 492-493: Trocar `LOVABLE_API_KEY` por `ANTHROPIC_API_KEY`
- Linhas 497-501: Substituir fetch ao gateway por fetch à Anthropic API
  - Extrair `system` do array de messages (primeiro item role=system)
  - Enviar como campo top-level `system`
  - Adicionar `max_tokens: 1024`
  - Headers: `x-api-key`, `anthropic-version: 2023-06-01`
  - Model: `claude-haiku-3-5-20251001`
- Linha 509: Trocar `choices[0].message.content` por `content[0].text`

**2. `supabase/functions/execute-broadcast/index.ts`**
- Linha 26: Trocar `LOVABLE_API_KEY` por `ANTHROPIC_API_KEY`
- Linha 302: Ajustar condição para checar `ANTHROPIC_API_KEY`
- Linhas 306-320: Substituir fetch ao gateway por Anthropic API (mesmo padrão)
  - `system` = `fullSystemPrompt`, messages = só o user message
  - Model: `claude-haiku-3-5-20251001`
- Linha 323: Trocar `choices[0].message.content` por `content[0].text`

**3. `supabase/functions/ai-follow-up/index.ts`**
- Linhas 19-20: Trocar `LOVABLE_API_KEY` por `ANTHROPIC_API_KEY`
- Linhas 169-183: Substituir fetch ao gateway por Anthropic API
  - Extrair system prompt, enviar só user message no array
  - Model: `claude-haiku-3-5-20251001`
- Linha 191: Trocar `choices[0].message.content` por `content[0].text`

### Resumo
- 1 secret a adicionar: `ANTHROPIC_API_KEY`
- 3 arquivos editados, ~3 trechos cada
- Nenhuma outra lógica alterada

