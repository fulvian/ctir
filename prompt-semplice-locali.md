# Prompt Semplici per LLM Locale (CTIR Routing)

## ✅ Prompt Garantiti per Routing Locale

### 1. **Correzione Sintassi Semplice**
```
Fix this typo: console.lo("hello world")
```

### 2. **Formattazione Base**
```
Format this code: function test(){return"hello"}
```

### 3. **Aggiunta Punto e Virgola**
```
Add semicolons: const a = 1 const b = 2
```

### 4. **Correzione Indentazione**
```
Fix indentation: def hello(): print("world")
```

### 5. **Rinomina Variabile**
```
Rename variable 'x' to 'count' in this code
```

### 6. **Aggiunta Commento**
```
Add a comment explaining what this function does
```

### 7. **Rimozione Spazi Extra**
```
Remove extra spaces from this string
```

### 8. **Conversione Case**
```
Convert this to camelCase: user_name
```

### 9. **Aggiunta Parentesi**
```
Add missing parentheses: if x > 5 console.log("big")
```

### 10. **Correzione Quote**
```
Fix quotes: const msg = 'hello world"
```

## 🧪 Test di Routing

Per testare se un prompt viene instradato al modello locale:

```bash
curl -X POST http://localhost:3001/analyze-task \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "IL_TUO_PROMPT_QUI"
      }
    ],
    "model": "claude-3-5-sonnet-20241022"
  }' | jq '.routing_decision.strategy'
```

**Risultati Attesi:**
- `"ccr_local"` → Modello locale Ollama
- `"mcp_delegate"` → Agente MCP locale
- `"claude_direct"` → Claude Code (per task complessi)

## 📊 Strategie di Routing

- **ccr_local**: Task semplici, formattazione, correzioni sintassi
- **mcp_delegate**: Task specializzati, testing, documentazione
- **claude_direct**: Task complessi, architettura, design

## 🎯 Come Usare

1. **Copia** uno dei prompt semplici sopra
2. **Incolla** in Claude Code
3. **Verifica** nei log CTIR che sia stato instradato localmente
4. **Monitora** il risparmio di token Claude
