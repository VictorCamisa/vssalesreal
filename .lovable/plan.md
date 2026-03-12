

# Por que o lead não recebe resposta

## Problemas Encontrados

### 1. Modelo Anthropic inválido no `ai-whatsapp-hook` (CRÍTICO)

**Linha 489** de `supabase/functions/ai-whatsapp-hook/index.ts`:
```
model: "claude-haiku-3-5-20251001"
```

Este é o **mesmo modelo inexistente** que foi corrigido no `execute-broadcast`, mas a correção **não foi aplicada aqui**. Toda chamada à API Anthropic retorna 404, a função loga "AI error: 404" e retorna sem enviar nada ao lead.

Diferente do `execute-broadcast`, aqui não há fallback — é uma chamada direta sem retry.

**Correção:** Aplicar o mesmo sistema de fallback com lista de modelos válidos, priorizando `claude-3-5-haiku-20241022`.

### 2. Sem logs = webhook pode não estar chegando

Os logs do `ai-whatsapp-hook` estão completamente vazios. Isso pode significar:
- A instância do Evolution API foi criada **antes** do webhook ser configurado automaticamente
- O webhook falhou silenciosamente durante a criação

**Correção:** Não é um problema de código — o webhook já é reconfigurado automaticamente quando o status é verificado (linhas 201-219 do `manage-evolution`). Basta o usuário verificar o status da instância na interface, ou chamar a action `setup-webhook` manualmente.

### 3. CORS hardcoded no `manage-evolution`

Mesmo problema já corrigido em `scrape-leads` e `ai-follow-up` — origem fixa que bloqueia o preview.

**Correção:** Aplicar a mesma lógica de multi-origem.

---

## Plano de Implementação

### Tarefa 1: Adicionar fallback de modelos no `ai-whatsapp-hook`
**Arquivo:** `supabase/functions/ai-whatsapp-hook/index.ts`
- **Linhas 481-500**: Substituir chamada única ao modelo inválido por loop de fallback com lista `["claude-3-5-haiku-20241022", "claude-3-5-haiku-latest", "claude-3-haiku-20240307"]`
- Mesmo padrão já usado no `execute-broadcast`

### Tarefa 2: Corrigir CORS no `manage-evolution`
**Arquivo:** `supabase/functions/manage-evolution/index.ts`
- **Linhas 3-7**: Substituir origin hardcoded pela lógica de `allowedOrigins` + `corsOrigin` dinâmico (mesmo padrão de `scrape-leads`)

**Total: 2 arquivos editados.**

