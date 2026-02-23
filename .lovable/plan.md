

# Vendas Inteligentes — Plano de Implementação MVP

## Fase 1: Fundação (Auth + Layout + Modelo de Dados)

### Autenticação e Multi-tenancy
- Login com email/senha e Google OAuth via Supabase Auth
- Tabela `organizations` com owner, tabela `user_roles` para permissões
- Fluxo de onboarding: criar organização ao primeiro login
- Perfil do usuário vinculado à organização

### Modelo de Dados (Supabase)
- **organizations** — id, name, owner_id
- **profiles** — id, user_id, org_id, full_name, avatar
- **user_roles** — user_id, role (admin/member)
- **integrations** — id, org_id, service_name, api_key, endpoint_url, status
- **leads_raw** — id, org_id, name, phone, email, source, status, enrichment_data (JSONB), external_mapping
- **crm_stages** — id, org_id, name, order
- **opportunities** — id, lead_id, stage_id, assigned_to, value, probability, notes
- RLS em todas as tabelas com políticas baseadas em org_id

### Layout Base
- Tema dark profissional com palette azul profundo (#0F172A) e cobalto (#2563EB)
- Sidebar colapsável com navegação: Dashboard, Prospecção, Leads, CRM, Configurações
- Top bar com busca global e seletor de organização
- Dashboard com cards de métricas (leads captados, em pipeline, convertidos)

---

## Fase 2: Módulo de Configurações e Integrações

### Gestão de API Keys
- Tela com formulários para inserir chaves: Firecrawl, Hasdata, Evolution API
- Armazenamento seguro das chaves na tabela `integrations`
- Botão "Testar Conexão" para cada serviço (Edge Function que faz um ping na API)

### Conector Supabase Externo
- Campos para SUPABASE_URL e SUPABASE_ANON_KEY do cliente
- Edge Function que lê metadados das tabelas do Supabase externo
- Interface para mapear quais tabelas/colunas sincronizar
- Salvar mapeamento em JSONB na tabela organizations

---

## Fase 3: Módulo de Prospecção (Geração de Demanda)

### Web Scraping via Firecrawl
- Interface de busca: palavras-chave + localização + URL alvo
- Edge Function que chama Firecrawl para scraping e extração
- Mapeamento de campos (Nome, Telefone, Email, Fonte) antes de salvar
- Loading com Skeleton components durante as chamadas

### Integração WhatsApp (Evolution API)
- Tela com tabs: Membros de Grupos / Contatos Gerais / Lista de Chats
- Edge Function que conecta na instância Evolution do usuário
- Extração de membros de grupos específicos e contatos sem nome
- Validação via Zod da instância antes de extrair

### Saneamento Automático
- Formatação de telefones para E.164 (remoção de caracteres, prefixo de país)
- Capitalização automática de nomes
- Deduplicação por número de telefone

---

## Fase 4: Módulo de Organização (Leads Raspados)

### Inbox de Triagem
- Data Table avançada com filtros por fonte, status, data
- Seleção múltipla de leads com ações em lote
- Busca e ordenação por colunas

### Enriquecimento de Dados
- Botão "Enriquecer" que dispara Edge Function (Perplexity/Clearbit)
- Busca automática de CNPJ, redes sociais, email corporativo
- Resultados salvos no campo JSONB `enrichment_data`

### Qualificação e Envio ao CRM
- Sistema "Dedo no Gatilho": selecionar leads → enviar para pipeline com 1 clique
- Mudança automática de status: pending → enriched → converted

---

## Fase 5: Módulo CRM (Ativação da Demanda)

### Kanban Multi-função
- Board drag-and-drop com colunas configuráveis
- Divisão por papéis: SDR (Qualificação), BDR (Prospecção Ativa), Closer (Fechamento)
- Cards com info do lead, valor estimado, probabilidade

### Gestão de Oportunidades
- Modal de detalhes com histórico de interações
- Atribuição de responsável (membro da organização)
- Automação de status baseada em mudança de coluna

---

## Segurança e Edge Cases
- RLS em todas as tabelas filtrando por org_id
- Rate limiting nas Edge Functions de scraping
- Validação Zod em todos os inputs de formulário
- Sanitização de dados antes de persistir

