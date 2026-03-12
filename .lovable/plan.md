

## Plano: Edge Function `migrate-api-keys`

Função temporária one-shot para criptografar API keys legadas em texto plano.

### Arquivo: `supabase/functions/migrate-api-keys/index.ts`

- Importa `encrypt` de `../_shared/crypto.ts`
- Verifica header `x-internal-secret` contra `BROADCAST_INTERNAL_SECRET` (já existe nos secrets)
- Usa `supabaseAdmin` (service role) para buscar todas as `integrations`
- Filtra registros onde `api_key` não é null, não é vazio, e **não contém `:`** (plain-text)
- Para cada um, chama `encrypt(api_key, ENCRYPTION_KEY)` e faz update
- Retorna `{ migrated, skipped, errors }` com detalhes
- Não precisa de `config.toml` entry (default `verify_jwt = true` é ok pois a autenticação é via header interno)

Após execução, a função será deletada via ferramenta.

