

## S-02: Criptografia de API Keys — Plano Corrigido

### Correções aplicadas

1. **Sem entrada no `config.toml`** — a função `manage-integrations` usa o default `verify_jwt = true`, que com signing-keys exige validação em código
2. **JWT obrigatório** — valida via `getClaims(token)` no início da função; rejeita 401 se inválido
3. **Frontend não precisa de header manual** — `supabase.functions.invoke()` já envia `Authorization: Bearer <token>` automaticamente

### Arquivos e mudanças

#### 1. `supabase/functions/_shared/crypto.ts` (NOVO)
- `encrypt(text, key)`: AES-256-GCM, IV 12 bytes, retorna `{iv_hex}:{ciphertext_hex}`
- `decrypt(encryptedText, key)`: separa IV:ciphertext, descriptografa

#### 2. `supabase/functions/manage-integrations/index.ts` (NOVO)
- CORS headers padrão
- Autenticação: extrai token do `Authorization` header, valida com `getClaims(token)`, obtém `userId` do `sub`
- Verifica membership via query em `profiles` (org_id do user = org_id da request)
- **Action `save`**: criptografa `api_key` → upsert em `integrations`
- **Action `load`**: lê integrations da org → descriptografa `api_key` → retorna

#### 3. `src/pages/SettingsPage.tsx` (ALTERADO)
- Substituir `supabase.from("integrations")` por `supabase.functions.invoke("manage-integrations", { body: { action, ... } })`
- Sem header manual — o SDK já injeta o Bearer token

#### 4. `supabase/config.toml` — NENHUMA ALTERAÇÃO
Não adicionar entrada para `manage-integrations`. O default já exige JWT.

