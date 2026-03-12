

# Plano: N-02 (Hook de instâncias) + N-03 (Handoff com verificação)

## 1. N-02 — Criar `src/hooks/useEvolutionInstances.ts`

Extrair toda a lógica duplicada de gestão de instâncias Evolution API das duas páginas para um hook centralizado.

**O hook exporta:**
- `instances`, `instancesLoading` — lista e estado de carregamento
- `createInstance(name)` — cria instância, retorna QR se disponível
- `deleteInstance(name)` — remove instância
- `getQRCode(name)` — obtém QR code
- `connectionStatus` — estado de conexão (`waiting | connected | error`)
- `qrCode`, `qrDialogOpen`, `qrInstanceName`, `qrLoading` — estado do dialog QR
- `setQrDialogOpen` — controle externo do dialog
- `selectedInstance`, `setSelectedInstance` — instância selecionada
- `fetchInstances` — refresh manual

**Lógica incluída no hook:**
- `fetchInstances` (linhas 127-142 de Prospecting / 39-50 de WhatsAppConnection)
- `handleCreateInstance` (linhas 146-165 / 54-81)
- `handleGetQR` (linhas 167-180 / 83-96)
- `handleDeleteInstance` (linhas 182-193 / 98-110)
- Polling de QR status (linhas 196-221 / 113-139)
- Estado completo de QR dialog

**Diferenças entre as duas páginas a reconciliar:**
- WhatsAppConnection faz sanitização do nome (`replace(/[^a-zA-Z0-9_-]/g, "_")`) e `logActivity` — **manter ambos no hook**
- Prospecting auto-seleciona instância conectada no fetch — **manter no hook**
- WhatsAppConnection não tem `selectedInstance` — **o hook expõe mas a página não precisa usar**

**Alterações em `src/pages/Prospecting.tsx`:**
- Remover linhas 82-93 (estados de instância), 127-221 (funções + polling)
- Importar e usar `useEvolutionInstances()`
- Manter toda a lógica de scraping, extração, grupos, manual, file upload intacta

**Alterações em `src/pages/WhatsAppConnection.tsx`:**
- Remover linhas 28-37 (estados), 39-139 (funções + polling)
- Importar e usar `useEvolutionInstances()`
- Manter `chatViewerInstance`, `getStatusInfo`, UI intacta

---

## 2. N-03 — Handoff com verificação de entrega

**Arquivo:** `src/pages/CRM.tsx`, função `sendManualHandoff` (linhas 221-284)

**Alterações no bloco try/catch (linhas 269-282):**

```typescript
try {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  const { data: result, error } = await supabase.functions.invoke("manage-evolution", {
    body: {
      action: "sendText",
      instanceName,
      number: handoffNumber.replace(/\D/g, ""),
      text: lines,
    },
  });

  clearTimeout(timeout);

  if (error) throw error;

  if (result?.error || !result?.key) {
    toast({
      title: "Falha no envio do handoff",
      description: "Verifique a instância WhatsApp",
      variant: "destructive",
    });
  } else {
    toast({ title: "Ficha enviada para handoff! ✅" });
  }
} catch (err: any) {
  if (err.name === "AbortError") {
    toast({
      title: "Handoff enviado mas entrega não confirmada",
      description: "Timeout de 10s — verifique manualmente",
      variant: "destructive",
    });
  } else {
    toast({ title: "Erro ao enviar handoff", description: err.message, variant: "destructive" });
  }
}
```

**Nota:** `supabase.functions.invoke` não suporta `AbortController` nativamente. A implementação usará `Promise.race` com um timeout de 10s em vez de `AbortController`:

```typescript
const sendPromise = supabase.functions.invoke("manage-evolution", { body: { ... } });
const timeoutPromise = new Promise((_, reject) =>
  setTimeout(() => reject(new Error("TIMEOUT")), 10000)
);
const { data: result, error } = await Promise.race([sendPromise, timeoutPromise]);
```

---

## Resumo de arquivos

| Arquivo | Ação |
|---------|------|
| `src/hooks/useEvolutionInstances.ts` | **Criar** — hook centralizado |
| `src/pages/Prospecting.tsx` | Remover lógica duplicada, usar hook |
| `src/pages/WhatsAppConnection.tsx` | Remover lógica duplicada, usar hook |
| `src/pages/CRM.tsx` | Alterar `sendManualHandoff` (~15 linhas) |

Nenhuma outra lógica será alterada.

