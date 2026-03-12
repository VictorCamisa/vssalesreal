

## Plano: Substituir keyword matching por busca vetorial no ai-whatsapp-hook

### Arquivo: `supabase/functions/ai-whatsapp-hook/index.ts`

**Trecho a substituir:** linhas 289–336 (toda a seção "Smart knowledge retrieval")

**Nova lógica:**

```typescript
// ---- Semantic knowledge retrieval (RAG) ----
let knowledgeContext = "";
try {
  const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");
  if (GOOGLE_API_KEY) {
    const embResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${GOOGLE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "models/gemini-embedding-001",
          content: { parts: [{ text: messageText }] },
          outputDimensionality: 768,
        }),
      }
    );

    if (embResponse.ok) {
      const embData = await embResponse.json();
      const queryVector = embData?.embedding?.values;

      if (queryVector?.length === 768) {
        const { data: knowledgeDocs } = await supabaseAdmin.rpc(
          "match_knowledge_docs",
          {
            query_embedding: JSON.stringify(queryVector),
            match_org_id: orgId,
            match_threshold: 0.5,
            match_count: 5,
          }
        );

        if (knowledgeDocs?.length) {
          const contextParts = knowledgeDocs.map(
            (doc: any) => `## ${doc.title}\n${doc.content.substring(0, 1500)}`
          );
          knowledgeContext = `\n\n--- BASE DE CONHECIMENTO ---\n${contextParts.join("\n\n")}\n--- FIM ---`;
        }
      }
    } else {
      console.error("Embedding API error:", embResponse.status);
    }
  }
} catch (ragErr) {
  console.error("RAG retrieval failed:", ragErr);
}
```

### Resumo
- Remove toda a lógica de keyword/chunk scoring (linhas 289-336)
- Gera embedding da mensagem via Google API (`gemini-embedding-001`)
- Chama `match_knowledge_docs` RPC com o vetor
- Fallback silencioso: se falhar, `knowledgeContext` fica vazio e o fluxo continua
- Nenhuma outra lógica alterada

