

# Simplificacao do Sistema Multi-Agente + Roteamento Inteligente

## Problema Atual
- O sistema suporta apenas 1 agente por numero WhatsApp
- O webhook (`ai-whatsapp-hook`) busca `ai_configs` com `eq("instance_name", instanceName).maybeSingle()` — se houver mais de 1, quebra
- A UI nao explica isso claramente ao usuario
- Nao existe opcao de roteamento automatico entre agentes

## O Que Vai Mudar

### 1. Banner Explicativo + Seletor de Modo na Aba Chatbot
No topo da aba Chatbot, adicionar:
- Card explicativo: "Seus agentes sao personalidades de IA que respondem no WhatsApp. Escolha como eles funcionam:"
- **Modo Simples** (padrao): Voce escolhe 1 agente por numero WhatsApp. Ex: SDR no numero de prospeccao, CS no numero de suporte.
- **Modo Inteligente**: Todos os agentes ficam ativos no mesmo numero. A IA detecta automaticamente qual personalidade usar baseado no contexto da conversa (lead novo = SDR, interessado = Closer, cliente ativo = CS, prospeccao fria = BDR).
- O modo escolhido e salvo em `ai_configs.config` como `{ routing_mode: "simple" | "smart" }`

### 2. Modo Simples (como funciona hoje, mas explicado)
- Cada card de agente mostra um dropdown "Ativar no numero:" com as instancias disponiveis
- Se um numero ja tem um agente, mostra badge "SDR ativo neste numero"
- Ao tentar ativar outro agente no mesmo numero, pergunta "Deseja substituir o SDR pelo Closer neste numero?"
- Fluxo visual claro: Agente -> Numero -> Ativar

### 3. Modo Inteligente (novo — super-agente com roteamento)
Quando o usuario escolhe "Modo Inteligente":
- Todos os agentes configurados ficam visiveis com toggle de ativar/desativar
- O usuario escolhe UM numero WhatsApp para o roteamento
- Uma UNICA `ai_config` especial e criada/atualizada com `config_type: "chatbot"` e `config.routing_mode: "smart"`
- O campo `config.agent_profiles` armazena array com as personalidades ativas (role, prompt resumido, criterios de ativacao)
- O system prompt dessa config especial inclui instrucoes de roteamento:

```text
Voce e um assistente multi-funcao. Analise a conversa e ESCOLHA qual personalidade usar:

PERFIS DISPONIVEIS:
1. SDR — Use quando: lead novo, primeira interacao, perguntas iniciais
2. Closer — Use quando: lead demonstrou interesse, pediu preco, quer proposta
3. CS — Use quando: ja e cliente, tem duvida de uso, quer suporte
4. BDR — Use quando: prospeccao fria, lead sem historico

REGRA: No inicio da resposta, inclua [PERFIL:SDR] (invisivel ao lead).
Depois responda normalmente com o tom e estrategia daquele perfil.
```

### 4. Mudancas no Webhook (`ai-whatsapp-hook`)
- Alterar a query de busca: em vez de `.maybeSingle()`, buscar TODAS as configs da instancia
- Se encontrar 1 config com `routing_mode: "smart"` → usar o super-prompt com roteamento
- Se encontrar 1 config com `routing_mode: "simple"` ou sem routing_mode → comportamento atual (1 agente fixo)
- No modo smart, enriquecer o prompt com historico da conversa (buscar ultimas msgs do `conversation_tracker`) para melhor deteccao de contexto

### 5. UI Simplificada dos Cards de Agentes
- Cada card mostra: emoji + nome amigavel + descricao em 1 frase simples
- No modo simples: dropdown de numero + toggle ativar
- No modo inteligente: apenas toggle ativar/desativar (o numero e global)
- Badge visual: "Ativo no +55..." ou "Ativo (modo inteligente)"

## Detalhes Tecnicos

### Arquivos a Modificar

1. **`src/pages/AIPage.tsx`** (ChatbotTab):
   - Adicionar estado `routingMode: "simple" | "smart"`
   - Banner explicativo no topo com seletor de modo
   - Condicionar a UI dos cards conforme o modo
   - No modo smart: mostrar seletor unico de instancia + toggles por agente
   - Salvar modo no banco ao trocar

2. **`supabase/functions/ai-whatsapp-hook/index.ts`**:
   - Linhas 71-77: trocar `.maybeSingle()` por busca que suporte multiplos configs
   - Adicionar logica: se config tem `routing_mode: "smart"`, montar super-prompt combinando todas as personalidades ativas
   - Buscar historico de mensagens do `conversation_tracker` para contexto de roteamento

### Fluxo do Modo Inteligente no Webhook

```text
Mensagem recebida
     |
Buscar ai_configs da instancia
     |
routing_mode == "smart"?
  SIM → Carregar todos os agent_profiles ativos
       → Montar super-prompt com instrucoes de roteamento
       → Incluir historico da conversa para contexto
       → IA escolhe personalidade automaticamente
  NAO → Comportamento atual (1 agente fixo)
```

### Nao precisa de migracao de banco
O campo `config` (jsonb) do `ai_configs` ja existe e comporta os novos campos (`routing_mode`, `agent_profiles`). Nenhuma alteracao de schema necessaria.

