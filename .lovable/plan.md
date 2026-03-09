

# Corrigir telefones do Auto X Veículos

## Situação atual
- **95 leads** no total
- **4** já possuem o prefixo `+55`
- **91** estão sem código do país (ex: `41999792033` em vez de `+5541999792033`)
- Os números já possuem o DDD correto (41, 42, 44, 11, 95, etc.)

## Plano

Executar um UPDATE direto no banco para adicionar o prefixo `+55` em todos os telefones que ainda não o possuem:

```sql
UPDATE leads_raw
SET phone = '+55' || phone
WHERE org_id = 'b9a844a8-1f0f-484c-8b2f-30ec01a50159'
  AND phone IS NOT NULL
  AND phone NOT LIKE '+55%';
```

Isso corrige os 91 números restantes sem alterar os 4 que já estão formatados.

