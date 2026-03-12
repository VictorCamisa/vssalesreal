

## Plano: Proteção anti-injection no ai-whatsapp-hook

### O que será feito

Duas alterações cirúrgicas no arquivo `supabase/functions/ai-whatsapp-hook/index.ts`:

**1. Envolver mensagens do usuário com delimitadores**

- **Linha 477** (histórico): mudar o content de mensagens `user` para incluir `[MENSAGEM DO USUÁRIO]...[/MENSAGEM DO USUÁRIO]`
- **Linha 483** (mensagem atual): mesma alteração

**2. Adicionar instrução anti-injection ao final do system prompt**

- **Linha 449**: adicionar ao final da variável `systemPrompt` o texto de proteção, após o `antiRepetitionReminder`

### Arquivos afetados

- `supabase/functions/ai-whatsapp-hook/index.ts` — 3 linhas editadas

Nenhuma outra lógica será alterada.

