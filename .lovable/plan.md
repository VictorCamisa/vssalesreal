

## Diagnóstico do Problema

Após analisar o código em profundidade (`ai-whatsapp-hook` tem 917 linhas com ~15 branches condicionais de prompt, `MySeller.tsx` com 1543 linhas, `AIPage.tsx` com 1960 linhas), o problema é claro:

**O sistema tem múltiplas fontes de prompt que competem entre si:**
- `system_prompt` no `ai_configs`
- `config.prompt_b2b`, `config.prompt_b2c_broadcast`, `config.prompt_b2c_organic` dentro do JSONB
- `config.modular` com sub-campos (tone, blocks, golden_rules, objections, ctas, b2b_context, b2c_context)
- Smart routing que tenta escolher entre configs
- Detecção de audience (hybrid/b2b/b2c) que substitui o prompt inteiro em runtime

O webhook tem tantos `if/else` que, dependendo do caminho, o prompt final pode ser completamente diferente do que o usuário configurou. Contexto vaza entre B2B e B2C, e cada novo cenário adiciona mais complexidade.

---

## Proposta: Arquitetura de "Cenários Fixos"

Simplificar para **4 cenários claros**, cada um com **1 prompt completo e isolado** por organização. Sem sobreposição, sem branches dinâmicos.

```text
┌─────────────────────────────────────────────────┐
│          CONFIGURAÇÃO DO USUÁRIO (1 vez)         │
│                                                   │
│  Cenário 1: PROSPECÇÃO OUTBOUND                   │
│  → Prompt fixo para empresas raspadas             │
│  → Tom B2B, qualificação, agendamento             │
│                                                   │
│  Cenário 2: DISPARO BASE PRÓPRIA                  │
│  → Prompt fixo para leads frios da base           │
│  → Tom depende do público do usuário              │
│                                                   │
│  Cenário 3: DISPARO WHATSAPP (grupos)             │
│  → Prompt fixo para leads de grupos               │
│  → Abordagem fria, apresentação                   │
│                                                   │
│  Cenário 4: ATENDIMENTO ORGÂNICO                  │
│  → Prompt fixo para quem chama no WhatsApp        │
│  → Receptivo, atendimento, qualificação           │
└─────────────────────────────────────────────────┘

Webhook recebe mensagem
  → Identifica cenário (via broadcast_leads ou orgânico)
  → Usa O PROMPT EXATO daquele cenário
  → Injeta contexto da empresa + base de conhecimento
  → Fim. Sem branches adicionais.
```

---

## Mudanças Técnicas

### 1. Nova tabela `ai_scenarios` (substituindo o uso multi-purpose de `ai_configs`)

```sql
CREATE TABLE ai_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  scenario_key TEXT NOT NULL, -- 'outbound_prospecting' | 'broadcast_own_base' | 'broadcast_whatsapp' | 'organic_inbound'
  name TEXT NOT NULL,
  system_prompt TEXT NOT NULL DEFAULT '',
  temperature NUMERIC DEFAULT 0.7,
  enabled BOOLEAN DEFAULT true,
  behavior JSONB DEFAULT '{}', -- max_messages, delay, emoji, context_window
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, scenario_key)
);
```

Cada org tem exatamente 4 registros, criados automaticamente. O prompt de cada cenário é completo e autocontido.

### 2. Webhook simplificado

A lógica do `ai-whatsapp-hook` cai de ~900 linhas para ~300:

1. Recebe mensagem → identifica org via instância
2. Verifica se lead veio de broadcast → `scenario_key = broadcast.scenario_key`
3. Se não é broadcast → `scenario_key = 'organic_inbound'`
4. Busca `ai_scenarios` com `org_id + scenario_key`
5. Monta prompt: `scenario.system_prompt` + contexto da empresa + base de conhecimento
6. Envia para IA. Fim.

Sem detecção de audience, sem hybrid mode, sem smart routing, sem branches B2B/B2C no webhook. O prompt já foi configurado pelo usuário com tudo que precisa.

### 3. UI simplificada no "Meu Vendedor"

Em vez de tabs B2B/B2C/Disparo com editor modular complexo, a tela mostra:

- **4 cards** (um por cenário), cada um com:
  - Nome e descrição do cenário
  - Textarea do prompt (o prompt completo)
  - Botão "Gerar com IA" (usa dados da empresa para criar prompt otimizado para aquele cenário)
  - Toggle ativo/inativo
  - Accordion com config de comportamento (delay, max msgs, emoji)

### 4. Integração com Broadcasts

A tabela `broadcasts` ganha coluna `scenario_key` (em vez de `ai_config_id`). Ao criar disparo, o usuário seleciona o cenário. Ao responder, o webhook usa o prompt daquele cenário.

### 5. Migração de dados

- Para cada org existente, criar 4 registros em `ai_scenarios` usando os prompts atuais dos `ai_configs`
- Manter `ai_configs` para compatibilidade (chatbot tab no AIPage), mas o webhook passa a ler de `ai_scenarios`

---

## Resultado Esperado

- Cada usuário configura **4 prompts claros**, um por cenário
- O prompt é **exatamente o que a IA usa** — sem transformações em runtime
- Dados da empresa e base de conhecimento são injetados automaticamente como contexto complementar
- Zero confusão entre B2B/B2C — o próprio prompt do cenário já define o tom
- Configuração feita **uma vez**, funciona **sempre igual**

---

## Arquivos Afetados

| Ação | Arquivo |
|------|---------|
| Criar | `supabase/migrations/xxx_ai_scenarios.sql` |
| Reescrever | `supabase/functions/ai-whatsapp-hook/index.ts` (~300 linhas) |
| Refatorar | `src/pages/MySeller.tsx` (UI dos 4 cenários) |
| Editar | `src/pages/Broadcasts.tsx` (usar scenario_key) |
| Manter | `src/pages/AIPage.tsx` (chatbot tab sem mudança) |

