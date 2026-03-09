

# Limpeza de Código Hardcoded no ai-whatsapp-hook

## Problema
O webhook tem 5 blocos de código específicos para distribuidoras de chopp que quebram qualquer outro nicho:

1. **Linhas 403-410**: Regex de anti-repetição com termos fixos (`chopp de vinho`, `chopp pilsen`, `sem glúten`, `artesanal`, `frota própria`, `carro-chefe`)
2. **Linhas 430-444**: Prefixo anti-alucinação com termos proibidos fixos (`instalação`, `cilindros`, `chopeira`, `suporte técnico`, `manutenção`)
3. **Linhas 438**: Perguntas limitadas a "quantidade, data, horário, local de entrega, forma de pagamento"
4. **Linhas 522-533**: Pós-processamento que remove sentenças com `chopeiras`, `cilindros`, `suporte técnico`, `manutenção`, `assistência`
5. **Linhas 500-501**: Cap de temperatura forçado em 0.4

## Mudanças no `supabase/functions/ai-whatsapp-hook/index.ts`

### 1. Anti-repetição genérica (linhas 403-424)
Substituir os regex hardcoded por extração dinâmica de N-gramas do histórico do bot. Em vez de patterns fixos de chopp, o sistema vai:
- Extrair substantivos/frases repetidos do `allBotText` usando split por sentenças
- Detectar frases que aparecem 2+ vezes nas últimas 20 mensagens
- Injetar essas frases detectadas como tópicos já mencionados

### 2. Prefixo anti-alucinação genérico (linhas 430-444)
Remover todos os termos proibidos fixos. O novo prefixo será:
- "Você SÓ pode falar sobre o que está EXPLICITAMENTE descrito neste prompt"
- "Se algo NÃO aparece nos dados abaixo, ele NÃO EXISTE"
- "Se o cliente perguntar algo fora dos dados, diga que vai verificar com a equipe"
- Remover a limitação "1-2 frases curtas" (já controlada pelo `maxCharsPerBlock` configurável)
- Remover a lista fixa de termos proibidos (instalação, cilindros, chopeira...)
- Remover a limitação de perguntas a "quantidade, data, horário..."

### 3. Pós-processamento genérico (linhas 522-533)
Remover completamente os `hallucinationPatterns` hardcoded. A anti-alucinação agora é responsabilidade do prompt (que o usuário controla) + a regra genérica no prefixo. Sem filtro de regex pós-resposta que dependa de termos de nicho.

### 4. Respeitar temperatura do usuário (linhas 500-501)
Remover o `Math.min(rawTemp, 0.4)`. Usar diretamente o valor configurado pelo usuário no cenário, com um fallback sensato de 0.7.

### 5. Lembrete final genérico (linhas 448-457)
Manter a estrutura mas remover referências a "logística (quando, onde, quanto)" que assume nicho de distribuição. Tornar genérico: "Foque em avançar a conversa conforme o processo de vendas da empresa".

### Arquivo modificado
- `supabase/functions/ai-whatsapp-hook/index.ts`

