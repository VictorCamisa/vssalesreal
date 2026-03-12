

## Plano: Autenticação JWT na Edge Function process-knowledge

### Alteração

**Arquivo:** `supabase/functions/process-knowledge/index.ts`

Inserir bloco de autenticação entre a linha 56 (`const { doc_id } = await req.json()`) e a linha 59 (`const supabaseAdmin = createClient(...)`):

1. Extrair header `Authorization`
2. Validar JWT com `supabaseAdmin.auth.getUser(token)`
3. Se inválido → retornar 401
4. Buscar `org_id` do usuário via tabela `profiles`
5. Após buscar o documento (linha 65-71), comparar `doc.org_id` com o `org_id` do perfil
6. Se não bater → retornar 403

### Código resultante (trecho modificado, linhas 52-71)

```typescript
// Mover criação do supabaseAdmin para antes da validação JWT
const supabaseAdmin = createClient(...);

// Auth check
const authHeader = req.headers.get("Authorization");
if (!authHeader?.startsWith("Bearer ")) {
  return new Response(JSON.stringify({ error: "Unauthorized" }), 
    { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
const token = authHeader.replace("Bearer ", "");
const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
if (authError || !user) {
  return new Response(JSON.stringify({ error: "Unauthorized" }), 
    { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// Get user org
const { data: profile } = await supabaseAdmin
  .from("profiles").select("org_id").eq("user_id", user.id).single();
if (!profile?.org_id) {
  return new Response(JSON.stringify({ error: "Forbidden" }), 
    { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// Fetch document (existing code)
const { data: doc, error: docError } = await supabaseAdmin
  .from("ai_knowledge_docs").select("*").eq("id", doc_id).single();
if (docError || !doc) throw new Error("Document not found");

// Verify org ownership
if (doc.org_id !== profile.org_id) {
  return new Response(JSON.stringify({ error: "Forbidden" }), 
    { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
```

### Resumo
- 1 arquivo editado
- Nenhuma outra lógica alterada
- Ordem: auth → parse body → validate user → fetch doc → check org → processar

