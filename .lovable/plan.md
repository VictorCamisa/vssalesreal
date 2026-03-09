

# Reconstrução Completa da Landing Page — VS SALES

## Diagnóstico

A landing page atual tem uma estrutura funcional, mas apresenta problemas críticos de copywriting, persuasão e design que a enfraquecem como ferramenta de conversão:

1. **Copy genérica** — frases como "Prospecção. Qualificação. Fechamento." não comunicam valor real. Falta dor, urgência e diferenciação.
2. **Seções repetitivas** — há dois comparativos (seção 2 e seção 5) que dizem quase a mesma coisa.
3. **Prova social fraca** — um depoimento fictício de "Carlos Mendes" não convence ninguém.
4. **Números inventados** — "12.400 leads qualificados" e "97% satisfação" sem contexto parecem falsos.
5. **Falta de seções-chave** — não há: demonstração visual do produto, seção "Para quem é", garantia, ecossistema VS.
6. **CTA disperso** — muitos CTAs competindo entre si sem hierarquia clara.
7. **Cor inconsistente** — usa verde (#00FF88) em vários elementos quando a marca é azul.

## Plano de Reconstrução

### Estrutura de seções (nova ordem narrativa)

```text
1. HERO — Headline de impacto + sub-headline com dor + CTA único forte
2. BARRA DE CREDIBILIDADE — "Powered by VS Soluções Labs" + tecnologias
3. O PROBLEMA — 4 cards de dor do gestor comercial (melhor copy)
4. A SOLUÇÃO — O que é o VS SALES (com mockup/screenshot do dashboard)
5. COMO FUNCIONA — 6 etapas do pipeline (mantido, refinado)
6. PARA QUEM É — 3 perfis ideais (Startups, PMEs, Agências)
7. DIFERENCIAIS — Grid de features com ícones e descrições curtas
8. COMPARATIVO ÚNICO — Tabela Time Humano vs VS SALES (consolidado)
9. PLANOS & PREÇOS — Cards dinâmicos do banco (mantido, refinado)
10. GARANTIA — Seção de confiança ("7 dias grátis" ou "Sem contrato")
11. FAQ — Perguntas frequentes (mantido, copy melhorada)
12. CTA FINAL — Urgência + formulário de acesso antecipado
13. FOOTER — Links + identidade VS Soluções
```

### Mudanças específicas

**Hero:**
- Nova headline: "Sua equipe comercial inteira. Só que é IA." com sub "SDR, BDR e Closer autônomos. 24/7. Por R$ 600/mês."
- Um único CTA principal: "Testar grátis por 7 dias"
- Remover contadores genéricos do hero, mover para seção de credibilidade
- Manter ParticleCanvas e animações stagger

**Seção "Para Quem É" (nova):**
- 3 cards: Startups B2B, PMEs com time enxuto, Agências que revendem
- Cada card com cenário real de uso

**Diferenciais (nova seção):**
- Grid 2x3: Prospecção Autônoma, WhatsApp Nativo, CRM Inteligente, IA Treinável, Disparos em Massa, Agendamento Auto
- Cada item com ícone + 2 linhas de copy

**Comparativo consolidado:**
- Remover o comparativo duplicado da seção "O Problema"
- Manter apenas a tabela da seção de planos, com visual mais impactante

**Prova social:**
- Remover depoimento fictício
- Substituir por métricas reais do sistema (operação 24/7, tempo de setup < 48h, etc.)

**Cores:**
- Substituir todo #00FF88 (verde) por variações de azul (#00D4FF, #0057FF)
- Manter verde apenas para indicadores de "positivo" em comparativos

**Seção de Garantia (nova):**
- "Sem contrato. Sem multa. Cancele quando quiser."
- Ícones de segurança (Shield, Lock, CheckCircle)

### Arquivos modificados

- `src/pages/Landing.tsx` — reescrita completa das seções, copy e estrutura

### Copy principles aplicados

- **Dor antes da solução** — mostrar o problema real antes de apresentar o produto
- **Especificidade** — usar números reais (R$ 600/mês, < 48h de setup, 24/7)
- **Um CTA por fold** — não competir com múltiplos botões
- **Prova > Promessa** — features concretas ao invés de adjetivos vagos

