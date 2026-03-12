

## Plano: Adicionar geração de embedding na process-knowledge

### Arquivo: `supabase/functions/process-knowledge/index.ts`

**1 ponto de inserção** — após o UPDATE bem-sucedido (linha 181), antes do return (linha 183):

```typescript
// Generate embedding via Google API
const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");
if (GOOGLE_API_KEY) {
  try {
    const embeddingResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${GOOGLE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "models/text-embedding-004",
          content: { parts: [{ text: doc.content.substring(0, 10000) }] },
        }),
      }
    );

    if (embeddingResponse.ok) {
      const embData = await embeddingResponse.json();
      const vector = embData?.embedding?.values;
      if (vector?.length === 768) {
        await supabaseAdmin
          .from("ai_knowledge_docs")
          .update({ embedding: JSON.stringify(vector) })
          .eq("id", doc_id);
      }
    } else {
      console.error("Embedding API error:", embeddingResponse.status);
    }
  } catch (embErr) {
    console.error("Embedding generation failed:", embErr);
  }
}
```

### Detalhes
- Trunca conteúdo em 10k chars para respeitar limites da API
- Falha silenciosa (try/catch) — documento já foi processado, embedding é bonus
- Usa `GOOGLE_API_KEY` já configurada nos secrets
- Serializa vetor como JSON string para compatibilidade com pgvector via PostgREST
- Nenhuma outra lógica alterada

