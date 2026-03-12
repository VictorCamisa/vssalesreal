

## Plano: Paginação server-side e filtros no Supabase — Leads.tsx

### Arquivo: `src/pages/Leads.tsx`

### 1. Novos estados (adicionar após linha 76)
```typescript
const [currentPage, setCurrentPage] = useState(0);
const [totalCount, setTotalCount] = useState(0);
const PAGE_SIZE = 50;
```

### 2. Substituir `fetchLeads` (linhas 83-112)
Nova versão com query única, filtros server-side, e `count: "exact"`:

```typescript
const fetchLeads = async () => {
  if (!profile?.org_id) return;
  setLoading(true);

  let query = supabase
    .from("leads_raw")
    .select("id, name, phone, email, source, status, tags, created_at, enrichment_data", { count: "exact" })
    .eq("org_id", profile.org_id)
    .order("created_at", { ascending: false })
    .range(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE - 1);

  // Server-side filters
  if (searchQuery) {
    query = query.or(`name.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`);
  }
  if (statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  }
  if (sourceFilter !== "all") {
    query = query.eq("source", sourceFilter);
  }
  if (quickFilter === "enriched") {
    query = query.not("enrichment_data", "is", null);
  } else if (quickFilter === "pending") {
    query = query.is("enrichment_data", null);
  } else if (quickFilter === "converted") {
    query = query.eq("status", "converted");
  }

  const { data, count } = await query;
  setLeads(data || []);
  setTotalCount(count || 0);
  setLoading(false);
};
```

### 3. Atualizar useEffect (linha 114)
Adicionar dependências dos filtros e página:
```typescript
useEffect(() => { fetchLeads(); }, [profile?.org_id, currentPage, searchQuery, statusFilter, sourceFilter, quickFilter]);
```

### 4. Remover useMemo de filtragem (linhas 121-137)
Substituir por referência direta — `filtered` vira `leads` (os dados já vêm filtrados do servidor). Adicionar debounce no search para evitar queries a cada tecla.

Todas as referências a `filtered` no template passam a usar `leads` diretamente.

### 5. Handlers de filtro resetam página
Cada `onChange` de filtro (search, status, source, quickFilter) reseta `currentPage` para 0. Como o useEffect já depende desses estados, o fetch é automático.

### 6. Stats cards (linhas 116-119)
Os contadores por status não podem mais ser calculados client-side (só temos 50 leads). Usar `totalCount` para "Total" e remover contadores individuais por status, ou mostrar apenas o total + contagem da página atual.

Alternativa simples: manter os stats mostrando `totalCount` como total, e os outros como "N/A" ou removê-los temporariamente, já que a contagem exata exigiria queries separadas.

**Decisão pragmática**: manter os 4 cards mas mostrar apenas "Total" com `totalCount`. Os outros 3 cards mostram a contagem dos leads da página atual com label "(nesta página)".

### 7. Paginação no rodapé (após linha 566, depois do `</Table>`)
```tsx
<div className="flex items-center justify-between p-4 border-t border-border/30">
  <p className="text-xs text-muted-foreground">
    {totalCount} leads no total — Página {currentPage + 1} de {Math.max(1, Math.ceil(totalCount / PAGE_SIZE))}
  </p>
  <div className="flex gap-2">
    <Button variant="outline" size="sm" className="rounded-xl"
      disabled={currentPage === 0}
      onClick={() => setCurrentPage(p => p - 1)}>
      Anterior
    </Button>
    <Button variant="outline" size="sm" className="rounded-xl"
      disabled={(currentPage + 1) * PAGE_SIZE >= totalCount}
      onClick={() => setCurrentPage(p => p + 1)}>
      Próxima
    </Button>
  </div>
</div>
```

### 8. Os 7 pontos que chamam `fetchLeads()`
Mantidos como estão (linhas 163, 178, 211, 228, 259, 332, 357). Cada um agora chama a nova versão que respeita os filtros e página corrente.

### 9. Quick filter chips (linhas 420-436)
Os counts nos chips não estarão mais disponíveis client-side. Remover os `(count)` dos labels ou mostrar apenas para o filtro ativo usando `totalCount`.

### Resumo das mudanças
- **fetchLeads**: query única com LIMIT/OFFSET + filtros server-side + `count: "exact"`
- **useMemo removido**: `filtered` → `leads` em todo o template
- **useEffect**: depende de `currentPage`, `searchQuery`, `statusFilter`, `sourceFilter`, `quickFilter`
- **Debounce**: no searchQuery para evitar queries excessivas
- **Paginação**: controles Anterior/Próxima no rodapé da tabela
- **Stats e chips**: adaptados para usar `totalCount` em vez de contagem client-side
- Nenhuma outra lógica alterada

