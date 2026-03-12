

# Plano: Integrar Cooldown nos 3 Edge Functions de Envio

## Arquivos a criar/editar

| Arquivo | Ação |
|---------|------|
| `supabase/functions/_shared/contact-cooldown.ts` | **Criar** — `isInCooldown` + `registerContact` |
| `supabase/functions/execute-broadcast/index.ts` | Editar — check + register + skip |
| `supabase/functions/ai-follow-up/index.ts` | Editar — check + register |
| `supabase/functions/ai-whatsapp-hook/index.ts` | Editar — register only (não bloqueia inbound) |

---

## 1. Criar `_shared/contact-cooldown.ts`

Exatamente como especificado — duas funções puras:
- `isInCooldown(supabase, phone, orgId)` → `boolean`
- `registerContact(supabase, phone, orgId, cooldownHours=24)` → `void` (upsert)

---

## 2. `execute-broadcast/index.ts`

**Importar** no topo:
```typescript
import { isInCooldown, registerContact } from "../_shared/contact-cooldown.ts";
```

**Antes do envio** (linha ~284, após check de `!lead?.phone`):
```typescript
const cleanPhone = lead.phone.replace(/\D/g, "");
if (await isInCooldown(supabase, cleanPhone, org_id)) {
  await supabase.from("broadcast_leads").update({
    status: "skipped", error_message: "Em cooldown",
  }).eq("id", bl.id);
  continue;
}
```

**Após envio bem-sucedido** (linha ~393, depois do upsert conversation_tracker):
```typescript
await registerContact(supabase, cleanPhone, org_id, 24);
```

---

## 3. `ai-follow-up/index.ts`

**Importar** no topo.

**Antes de enviar** (linha ~120, após check de `minutesSince < rule.delay_minutes`):
```typescript
const phone = conv.remote_jid.replace("@s.whatsapp.net", "");
if (await isInCooldown(supabaseAdmin, phone, conv.org_id)) {
  console.log(`Skipping follow-up for ${phone}: in cooldown`);
  continue;
}
```

Nota: a variável `phone` já é declarada na linha 198. Movo a declaração para antes do check de cooldown.

**Após envio bem-sucedido** (linha ~243, depois do update conversation_tracker):
```typescript
await registerContact(supabaseAdmin, phone, conv.org_id, 24);
```

---

## 4. `ai-whatsapp-hook/index.ts`

**Importar** no topo.

**Apenas registrar** — não bloquear respostas inbound.

**Após envio bem-sucedido** (linha ~668, dentro do `if (sendSuccess)`):
```typescript
await registerContact(supabaseAdmin, phone, orgId!, 24);
```

A variável `phone` já existe na linha 80.

---

## O que NÃO muda

- Nenhuma outra lógica dos 3 arquivos
- Nenhuma tabela ou migration
- Nenhum arquivo frontend

