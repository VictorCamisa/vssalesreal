

# Plano: Redesign Frontend "VS LEADS" - PRD Completo

## Resumo

Transformar a interface atual ("Vendas AI") no produto "VS LEADS" da "VS Soluções", aplicando rebranding completo, novo layout de login split-screen, dashboard com graficos, suporte a light/dark mode, tela dedicada de conexao WhatsApp, e dados mockados para visualizacao imediata.

---

## 1. Rebranding: VS Solucoes / VS LEADS

**Arquivos afetados:** `src/components/AppSidebar.tsx`, `src/pages/Auth.tsx`, `index.html`

- Substituir "Vendas AI" por "VS LEADS" em toda a interface
- Sidebar header: logo "VS Solucoes" + subtitulo "VS LEADS"
- Trocar icone Zap por um icone mais corporativo (Shield ou Rocket)
- Atualizar `<title>` no `index.html`

## 2. Identidade Visual: Light/Dark Mode + Tipografia

**Arquivos afetados:** `src/index.css`, `tailwind.config.ts`, `index.html`

- Adicionar variantes de cores para light mode (`:root` com cores claras)
- Manter dark mode atual como `.dark` 
- Integrar `next-themes` (ja instalado) com `ThemeProvider`
- Adicionar toggle de tema no header ou sidebar
- Trocar fonte para Inter (Google Fonts)
- Paleta: azul corporativo (#2563EB) + verde sucesso/WhatsApp (#22C55E)

## 3. Tela de Login Split-Screen

**Arquivo afetado:** `src/pages/Auth.tsx`

- Layout dividido 50/50:
  - **Esquerda**: Formulario de login (email/senha, Google OAuth)
  - **Direita**: Banner visual com gradiente, headline "Vendas 100% gerenciadas por IA", bullet points de beneficios, logo VS Solucoes
- Responsivo: em mobile, banner fica no topo resumido
- Manter toda a logica de autenticacao existente

## 4. Dashboard Expandido com Graficos

**Arquivo afetado:** `src/pages/Index.tsx`

- Expandir para 4 KPI cards:
  1. Total de leads capturados
  2. Instancias WhatsApp ativas
  3. Conversas IA em andamento
  4. Vendas concluidas
- Adicionar grafico de funil de conversao usando `recharts` (ja instalado)
  - Barras: Leads > Qualificados > Negociando > Vendidos
- Adicionar grafico de linha: evolucao de leads nos ultimos 7 dias
- Dados mockados iniciais para visualizacao imediata
- Secao de acoes rapidas mantida e estilizada

## 5. Tela Dedicada: Conexao WhatsApp

**Novo arquivo:** `src/pages/WhatsAppConnection.tsx`

- Extrair a logica de gerenciamento de instancias do `Prospecting.tsx` para tela propria
- Layout limpo:
  - Card centralizado com QR Code grande
  - Instrucoes em 3 passos ao lado (1. Abra o WhatsApp, 2. Aparelhos Conectados, 3. Escaneie)
  - Indicador de status animado (Desconectado/Conectando/Online)
  - Lista de instancias existentes com status visual
- Adicionar rota `/whatsapp` no `App.tsx`
- Adicionar item "Conexao WhatsApp" na sidebar com icone Smartphone

## 6. Leads: Status do Agente IA

**Arquivo afetado:** `src/pages/Leads.tsx`

- Adicionar novos status de IA na tabela: "Aguardando", "Qualificando", "Negociando", "Vendido"
- Coluna "Status IA" com badges coloridas
- Botoes de extracao no topo: "Extrair Contatos", "Extrair Grupos", "Extrair Conversas"
- Filtros por status de IA
- Dados mockados (20-30 leads ficticios) para demonstracao

## 7. Controle do Agente IA + Log de Atividades

**Arquivo afetado:** `src/pages/AIPage.tsx`

- Nova sub-tab "Controle" dentro da pagina IA:
  - Toggle "Disparador IA" (ativar/desativar globalmente)
  - Metricas do agente: mensagens enviadas, taxa de resposta, leads qualificados
- Feed de atividades em tempo real (mockado):
  - "IA iniciou conversa com Joao Silva"
  - "IA qualificou Maria Santos como lead quente"
  - "IA agendou reuniao com Pedro Oliveira"
  - Timestamps e icones por tipo de acao

## 8. Sidebar Atualizada

**Arquivo afetado:** `src/components/AppSidebar.tsx`

- Itens de navegacao atualizados:
  1. Dashboard (LayoutDashboard)
  2. Conexao WhatsApp (Smartphone)
  3. Meus Leads (Users)
  4. Prospecao (Search)
  5. CRM Pipeline (Kanban)
  6. Agente IA (Brain)
  7. Configuracoes (Settings)
- Branding "VS Solucoes" / "VS LEADS" no header

## 9. Layout e Header

**Arquivo afetado:** `src/components/AppLayout.tsx`

- Header com:
  - SidebarTrigger
  - Nome da pagina atual
  - Toggle de tema (sol/lua)
  - Avatar do usuario

## 10. Dados Mockados

**Novo arquivo:** `src/data/mockData.ts`

- 25 leads ficticios com nomes brasileiros, telefones, status variados
- 5 instancias WhatsApp (3 online, 1 connecting, 1 offline)
- 15 entradas de log de atividade da IA
- Dados para graficos (7 dias de metricas)
- Os dados mockados serao exibidos quando nao houver dados reais no banco

---

## Detalhes Tecnicos

### Estrutura de Arquivos

```text
src/
  data/
    mockData.ts                    (NOVO)
  pages/
    Auth.tsx                       (REFATORAR - split layout)
    Index.tsx                      (REFATORAR - KPIs + charts)
    WhatsAppConnection.tsx         (NOVO - tela dedicada)
    Leads.tsx                      (REFATORAR - status IA)
    AIPage.tsx                     (REFATORAR - tab controle)
    Prospecting.tsx                (REFATORAR - remover WhatsApp mgmt)
  components/
    AppSidebar.tsx                 (REFATORAR - rebranding + nav)
    AppLayout.tsx                  (REFATORAR - header)
    ThemeToggle.tsx                (NOVO)
  index.css                        (REFATORAR - light mode)
  App.tsx                          (REFATORAR - nova rota)
  main.tsx                         (REFATORAR - ThemeProvider)
```

### Dependencias

Nenhuma nova dependencia necessaria. Tudo ja esta instalado:
- `recharts` para graficos
- `next-themes` para dark/light mode
- `lucide-react` para icones
- Shadcn UI completo

### Ordem de Implementacao

1. Identidade visual (CSS + tema + fonte)
2. Rebranding (sidebar + auth + title)
3. Login split-screen
4. Dados mockados
5. Dashboard com graficos
6. Tela WhatsApp dedicada
7. Leads com status IA
8. Controle do Agente + Log
9. Layout/header refinado

