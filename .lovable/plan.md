

## Plano: Deduplicação de mensagens no ai-whatsapp-hook

A constraint UNIQUE na coluna `message_id` ainda **não existe** no banco. Precisamos criá-la primeiro, depois alterar o código.

### Passo 1: Migration SQL

```sql
ALTER TABLE public.chat_messages 
ADD CONSTRAINT chat_messages_message_id_unique UNIQUE (message_id);
```

### Passo 2: Alterar `saveMessage` (linhas 36-47)

Trocar `.insert()` por `.upsert()` com `ignoreDuplicates: true` e retornar se foi de fato inserido:

```typescript
const saveMessage = async (orgId: string, instName: string, jid: string, fromMe: boolean, text: string, pName?: string, msgId?: string): Promise<{ inserted: boolean; msgId: string | null }> => {
  try {
    const finalMsgId = msgId || `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const { data } = await supabaseAdmin.from("chat_messages").upsert({
      org_id: orgId, instance_name: instName, remote_jid: jid, from_me: fromMe,
      message_text: text, push_name: pName || null,
      message_id: finalMsgId,
      timestamp: new Date().toISOString(),
    }, { onConflict: "message_id", ignoreDuplicates: true }).select("id");
    const inserted = (data?.length ?? 0) > 0;
    return { inserted, msgId: finalMsgId };
  } catch (e) { console.error("saveMessage error:", e); return { inserted: false, msgId: null }; }
};
```

### Passo 3: Retorno antecipado na linha 65

```typescript
const saveResult = await saveMessage(orgId, instanceName, remoteJid, false, messageText, pushName, messageData.key?.id || null);
if (!saveResult.inserted) {
  console.log(`Message already processed: ${saveResult.msgId}`);
  return new Response(JSON.stringify({ status: "already_processed" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
```

### Ordem de execução

1. Rodar a migration (UNIQUE constraint) -- **primeiro, obrigatório**
2. Alterar o código da edge function
3. Deploy da edge function

### Arquivos afetados
- Migration SQL (1 statement)
- `supabase/functions/ai-whatsapp-hook/index.ts` — 2 trechos editados

