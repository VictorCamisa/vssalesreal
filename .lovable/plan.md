

## Plano: Normalizar temperature da IA nos 3 módulos

Três edições cirúrgicas, uma por arquivo. Nenhuma outra lógica alterada.

### 1. `supabase/functions/execute-broadcast/index.ts` (linha 141)
Substituir:
```
scenarioTemperature = Math.min(Number(scenario.temperature) || 0.7, 0.4);
```
Por:
```
scenarioTemperature = Math.max(0.2, Math.min(Number(scenario.temperature) ?? 0.3, 0.45));
```

### 2. `supabase/functions/ai-whatsapp-hook/index.ts` (linha 490)
Substituir:
```
const temperature = Number(scenario.temperature) || 0.7;
```
Por:
```
const temperature = Math.max(0.2, Math.min(Number(scenario.temperature) ?? 0.3, 0.45));
```

### 3. `supabase/functions/ai-follow-up/index.ts` (linha 183)
Substituir:
```
temperature: scenario.temperature ? Number(scenario.temperature) : 0.7,
```
Por:
```
temperature: Math.max(0.2, Math.min(Number(scenario.temperature) ?? 0.35, 0.45)),
```

Todas as funções passam a operar dentro do range **[0.2, 0.45]**, com defaults ligeiramente diferentes conforme solicitado (0.3, 0.3, 0.35). Deploy automático após edição.

