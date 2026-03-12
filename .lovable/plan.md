

## Plano: Consolidar blocos anti-alucinação em `ai-whatsapp-hook`

Quatro blocos redundantes serão reduzidos a um único bloco conciso no início do system prompt. O `antiInjectionGuard` permanece intacto.

### Blocos identificados (a remover/consolidar)

| # | Bloco | Linhas | Ação |
|---|-------|--------|------|
| 1 | `antiHallucinationPrefix` | 424-437 | **Substituir** pelo bloco consolidado |
| 2 | `behaviorParts` anti-invenção | 381-386 | **Remover** |
| 3 | `behaviorParts` anti-repetição | 412-419 | **Remover** (manter a lógica de scan do `botHistory` para referência futura, mas remover os pushes) |
| 4 | `antiRepetitionReminder` (LEMBRETE FINAL) | 439-447 | **Remover** |

### Bloco consolidado (substitui `antiHallucinationPrefix`)

```typescript
const antiHallucinationPrefix = `FONTES AUTORIZADAS: Responda APENAS com informações presentes no system prompt, contexto da empresa ou base de conhecimento fornecidos. Se não souber, diga que vai verificar com a equipe. Não repita informações já ditas. Não use aspas duplas. Não repita a saudação do disparo.${!useEmoji ? " ZERO emojis." : ""}\n\n`;
```

### Alterações no context size control

Atualizar linhas 451-469 para refletir a remoção de `antiRepetitionReminder`:
- `suffixParts` passa a ser apenas `antiInjectionGuard`
- `coreParts` continua com `antiHallucinationPrefix + scenario.system_prompt + behaviorRules + broadcastContext`

### O que NÃO muda
- `antiInjectionGuard` (linha 449) — intacto
- Lógica de `botHistory` scan (linhas 389-397) — mantida para uso futuro, apenas os `behaviorParts.push` anti-repetição são removidos
- `useEmoji` regra em `behaviorParts` (linha 372) — mantida (é comportamental, não anti-alucinação)
- Toda a lógica de truncamento, chamada à API, pós-processamento — intacta

