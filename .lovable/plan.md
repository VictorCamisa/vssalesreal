

# Plano: 3 Correções Cirúrgicas (W-04, S-03, S-04)

## 1. W-04 — `ai-whatsapp-hook/index.ts`: `.order("timestamp")` → `.order("created_at")`

Duas ocorrências encontradas:
- **Linha 390**: botHistory query — `.order("timestamp", ...)` → `.order("created_at", ...)`
- **Linha 453**: historyMsgs query — `.order("timestamp", ...)` → `.order("created_at", ...)`

---

## 2. S-03 — CORS: restringir origem em funções chamadas pelo browser

**Manter `"*"` (servidores externos):**
- `ai-whatsapp-hook` (Evolution API)
- `execute-broadcast` (interno)
- `crm-pipeline-automation` (GitHub Actions)

**Restringir ao domínio** (`Deno.env.get("ALLOWED_ORIGIN") || "https://vssalesreal.lovable.app"`):

| Função | Arquivo |
|--------|---------|
| admin-create-user | index.ts |
| admin-delete-user | index.ts |
| admin-list-users | index.ts |
| admin-update-password | index.ts |
| ai-chat | index.ts |
| ai-follow-up | index.ts |
| backfill-embeddings | index.ts |
| enrich-lead | index.ts |
| extract-whatsapp | index.ts |
| generate-prompt | index.ts |
| manage-appointments | index.ts |
| manage-evolution | index.ts |
| manage-integrations | index.ts |
| process-company-form | index.ts |
| process-knowledge | index.ts |
| review-conversations | index.ts |
| scrape-leads | index.ts |
| search-whatsapp-groups | index.ts |
| simulate-seller | index.ts |
| get-service-key | index.ts |

Cada arquivo terá a linha do `corsHeaders` alterada de `"*"` para a expressão com env var.

---

## 3. S-04 — `AuthContext.tsx`: remover setTimeout, adicionar profileLoading

Alterações em `src/contexts/AuthContext.tsx`:
- Adicionar estado `profileLoading`
- No `onAuthStateChange`: substituir `setTimeout(() => fetchProfile(...), 0)` por `await fetchProfile(...)`
- `fetchProfile` seta `profileLoading = true/false`
- Expor `profileLoading` no contexto

Alterações em `src/App.tsx`:
- No `AppRoutes`, ler `profileLoading` do contexto
- Mostrar spinner enquanto `loading || profileLoading`

---

## Resumo de arquivos alterados

- `supabase/functions/ai-whatsapp-hook/index.ts` (2 linhas)
- 20 edge functions (1 linha cada — corsHeaders)
- `src/contexts/AuthContext.tsx` (~10 linhas)
- `src/App.tsx` (~1 linha)

Nenhuma outra lógica será alterada.

