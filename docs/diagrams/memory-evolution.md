# Evolución con Memoria y Aprendizaje

## Timeline: Usuario A - Semana a Semana

### Semana 1 (Primera vez)

```
Lunes 9am:
  User: "Genera reporte de ventas"
  
  Agent: [sin historial, sin preferencias]
    ? ¿Qué formato prefieres? (PDF/Excel/HTML)
  User: "PDF"
  
  Agent:
    ? ¿Incluir gráficos?
  User: "Sí, con gráficos de barras"
  
  Agent:
    ? ¿A quién envío el reporte?
  User: "A mi manager: boss@company.com"
  
  Agent:
    ? ¿Qué período cubre? (semanal/mensual/trimestral)
  User: "Mensual, del mes pasado"
  
  Agent:
    ✓ Entendido. Generando reporte PDF mensual con gráficos...
    [ejecuta: data_fetcher → pdf_generator → email_sender]
    ✓ Reporte enviado a boss@company.com
  
  📊 Métricas:
    - Preguntas: 4
    - Tiempo total: 2 minutos
    - Parámetros inferidos: 0%
    - User satisfaction: ⭐⭐⭐ (neutral, muchas preguntas)
  
  💾 Sistema registra:
    - Execution record con todos los parámetros
    - Primera preferencia detectada (débil, confidence: 0.3)
```

### Semana 2 (Empezando a aprender)

```
Lunes 9am:
  User: "Genera reporte de ventas"
  
  Agent: [consulta historial: 1 ejecución previa]
    ? ¿PDF como la última vez?
  User: "Sí"
  
  Agent:
    ? ¿Con gráficos y envío a boss@company.com?
  User: "Correcto"
  
  Agent:
    ✓ Generando reporte mensual...
    ✓ Enviado
  
  📊 Métricas:
    - Preguntas: 2 (↓50%)
    - Tiempo total: 1 minuto (↓50%)
    - Parámetros inferidos: 50%
    - User satisfaction: ⭐⭐⭐⭐ (mejor)
  
  💾 Sistema actualiza:
    - 2 ejecuciones con mismos parámetros
    - Confidence aumenta: 0.3 → 0.6
```

### Semana 3 (Patrón detectado)

```
Lunes 9am:
  User: "Genera reporte de ventas"
  
  Agent: [consulta historial: 2 ejecuciones, patrón claro]
    ✓ Entendido. Reporte PDF mensual con gráficos,
      enviando a boss@company.com como siempre. ¿OK?
  User: "Perfecto"
  
  Agent:
    ✓ [ejecuta directamente]
    ✓ Completado en 12 segundos
  
  📊 Métricas:
    - Preguntas: 0 (solo confirmación)
    - Tiempo total: 30 segundos (↓75% vs semana 1)
    - Parámetros inferidos: 100%
    - User satisfaction: ⭐⭐⭐⭐⭐ (excelente!)
  
  💾 Sistema confirma:
    - Patrón establecido (confidence: 0.85)
    - Preferencias sólidas
```

### Semana 5 (Totalmente optimizado)

```
Lunes 9am:
  User: "Reporte de ventas"  ← Query más corta!
  
  Agent: [patrón muy confiable, confidence: 0.95]
    ✓ Generando tu reporte semanal PDF...
    [ejecuta en background]
    ✓ Listo! Enviado a boss@company.com
  
  📊 Métricas:
    - Preguntas: 0
    - Tiempo total: 15 segundos (↓87% vs semana 1)
    - Parámetros inferidos: 100%
    - User satisfaction: ⭐⭐⭐⭐⭐
  
  💡 Extra: Agent detecta patrón temporal
    "Noto que pides esto cada lunes a las 9am.
     ¿Quieres que lo programe automáticamente?"
```

---

## Usuario A vs Usuario B (Personalización)

### Usuario A (Manager)

```
Preferencias aprendidas:
  generate_sales_report:
    format: pdf
    includeCharts: true
    detailLevel: summary          ← Resumen ejecutivo
    recipients: [boss@company.com]
    period: monthly
    
Patrón:
  frequency: weekly (cada lunes 9am)
  style: concise (respuestas breves)
```

### Usuario B (Analyst)

```
Preferencias aprendidas:
  generate_sales_report:
    format: excel                 ← Diferente!
    includeCharts: true
    detailLevel: detailed         ← Mucho más detalle!
    recipients: [team@company.com, self]
    period: daily                 ← Más frecuente!
    additionalMetrics: [cohort, retention]  ← Extra!
    
Patrón:
  frequency: daily (cada día 2pm)
  style: technical (jerga técnica OK)
```

**Mismo skill, ejecución totalmente diferente** ✅

---

## Override Explícito

```
Usuario A (que siempre usa PDF):
  User: "Genera reporte de ventas, pero en Excel esta vez"
  
  Agent: [detecta override explícito]
    ✓ Entendido, Excel esta vez. 
    ✓ Mantengo gráficos y destinatarios habituales?
  User: "Sí"
  
  Agent:
    ✓ [ejecuta con format=excel, resto de preferencias]
  
  💾 Sistema registra:
    - Variación detectada
    - NO actualiza default (fue override puntual)
    - Si se repite 3+ veces → actualiza preferencia
```

---

## Learning Algorithms

### 1. Frequency-Based Learning

```python
def learn_preference(user_id, skill_id, param, value):
    history = get_execution_history(user_id, skill_id)
    
    # Contar frecuencia del valor
    occurrences = count_param_value(history, param, value)
    total = len(history)
    frequency = occurrences / total
    
    # Si >70% de veces, es preferencia
    if frequency > 0.7:
        set_preference(user_id, skill_id, param, value)
        confidence = frequency
```

### 2. Context-Aware Learning

```python
def detect_contextual_pattern(user_id, skill_id):
    history = get_execution_history(user_id, skill_id)
    
    # Agrupar por contexto
    patterns = {}
    for exec in history:
        context = extract_context(exec)  # day, time, etc
        key = hash_context(context)
        
        if key not in patterns:
            patterns[key] = []
        patterns[key].append(exec.parameters)
    
    # Detectar patrones fuertes
    for context, executions in patterns.items():
        if len(executions) >= 3:
            common_params = find_common_params(executions)
            register_pattern(user_id, skill_id, context, common_params)
```

### 3. Collaborative Filtering (Futuro)

```python
def suggest_based_on_similar_users(user_id, skill_id):
    # Encontrar usuarios similares
    similar_users = find_similar_users(user_id)
    
    # Ver qué parámetros usan para este skill
    their_preferences = [
        get_preferences(u, skill_id) for u in similar_users
    ]
    
    # Sugerir parámetros comunes que user_id no ha probado
    suggestions = find_uncommon_preferences(
        get_preferences(user_id, skill_id),
        their_preferences
    )
    
    return suggestions
```

---

## Privacidad y Control

### User Control

```typescript
// Usuario puede:

// 1. Ver su memoria
GET /api/skillbank/memory/user/:userId

// 2. Borrar historial
DELETE /api/skillbank/memory/user/:userId/history

// 3. Resetear preferencias
DELETE /api/skillbank/memory/user/:userId/preferences

// 4. Opt-out de learning
POST /api/skillbank/memory/user/:userId/settings
{
  enableLearning: false
}

// 5. Exportar datos
GET /api/skillbank/memory/user/:userId/export
```

### Privacy by Design

- ✅ Datos por usuario están aislados
- ✅ No se comparten preferencias entre usuarios
- ✅ Usuario puede borrar todo su historial
- ✅ Opt-out de learning available
- ✅ Export completo de datos (GDPR compliance)

---

## Conclusión

**Memory & Learning es la cereza del pastel** 🍒

```
Sin memoria:
  Agente olvida → Pregunta cada vez → Ineficiente

Con memoria:
  Agente recuerda → Aprende patrones → Optimiza

Resultado:
  Primera ejecución:  2 minutos, 4 preguntas
  Décima ejecución:   15 segundos, 0 preguntas
  
  = 88% más rápido, 100% menos fricción
```

**El sistema que aprende es el que gana** 📈

