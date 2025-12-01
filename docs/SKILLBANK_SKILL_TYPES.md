# Skill Bank - Tipos de Skills

## Evolución del Concepto

### Original: Tool Orchestration

```yaml
skill: stripe_api_handler
usesTools: [http_request]
type: tool_based
```

**Limitación:** Asume que toda skill ejecuta tools externas.

### Expandido: Knowledge Augmentation ⭐

Las skills pueden ser:
1. **Tool-based** - Orquesta tools externas
2. **Instructional** - Proporciona conocimiento/método (no ejecuta nada)
3. **Context-aware** - Apunta a dónde encontrar información
4. **Hybrid** - Combina tools + instrucciones + contexto

---

## Tipo 1: Tool-Based Skills (Original)

### Definición
Skills que **orquestan tools** para ejecutar acciones externas.

### Ejemplo: stripe_api_handler

```yaml
id: stripe_api_handler
skillType: tool_based
usesTools: [http_request]

overview: |
  Interactúa con Stripe API para procesar pagos.

instructions:
  steps:
    - Obtener STRIPE_SECRET_KEY
    - Ejecutar http_request POST a Stripe
    - Parsear respuesta
    - Retornar charge_id
```

**Características:**
- ✅ Ejecuta tools externas
- ✅ Produce side effects (crea recursos, modifica estado)
- ✅ Requiere credentials
- ✅ Puede fallar por errores externos

---

## Tipo 2: Instructional Skills ⭐ NEW

### Definición
Skills que **proporcionan metodología** para que el agente use sus capacidades nativas.

### Ejemplo 1: create_cornell_notes

```yaml
id: create_cornell_notes
skillType: instructional
usesTools: []  # No tools!
nativeCapabilities: [text_generation, structuring]

overview: |
  Guía para crear notas usando el método Cornell.
  El agente usa sus capacidades nativas de generación y estructuración.

instructions:
  methodology: |
    Método Cornell de Notas (desarrollado en Cornell University):
    
    Estructura de 3 columnas:
    1. Cue Column (izquierda, 30%): Preguntas clave y conceptos
    2. Note-taking Column (derecha, 70%): Notas principales
    3. Summary Section (abajo): Resumen de 5-7 líneas
  
  steps:
    - Leer el texto completo
    - Identificar conceptos principales y temas
    - Crear columna de notas con detalles importantes
    - Generar preguntas clave para la columna Cue
    - Escribir resumen conciso al final
    - Formatear en markdown con tabla de 2 columnas
  
  bestPractices:
    - Las preguntas Cue deben ser específicas y provocar reflexión
    - Notas deben usar bullet points, no párrafos largos
    - Resumen debe capturar la esencia, no detalles
    - Usar abreviaciones consistentes
  
  template: |
    # Notas Cornell: [Título]
    
    | Cue Column | Notes |
    |------------|-------|
    | ¿Pregunta clave 1? | • Punto principal<br>• Detalle importante |
    | ¿Pregunta clave 2? | • Otro concepto<br>• Ejemplo relevante |
    
    ## Summary
    [Resumen de 5-7 líneas capturando la esencia]

examples:
  - situation: Crear notas Cornell de un artículo sobre fotosíntesis
    input:
      text: "La fotosíntesis es el proceso... [texto largo]"
    expectedOutput: |
      Tabla formateada con:
      - Cue: "¿Qué es fotosíntesis?", "¿Fases principales?"
      - Notes: Detalles del proceso
      - Summary: Resumen del concepto completo
    notes: Agente usa LLM nativo para generar, no ejecuta tools
```

**Características:**
- ✅ No ejecuta tools externas
- ✅ Usa capacidades nativas del LLM (generar, estructurar, resumir)
- ✅ Proporciona metodología/plantilla
- ✅ No requiere credentials
- ✅ Siempre disponible (no depende de servicios externos)

### Ejemplo 2: summarize_with_5w1h

```yaml
id: summarize_with_5w1h
skillType: instructional
nativeCapabilities: [text_analysis, summarization]

overview: |
  Método para resumir texto usando las 6 preguntas fundamentales.

instructions:
  methodology: |
    Método 5W1H (Journalism):
    - Who (Quién)
    - What (Qué)
    - When (Cuándo)
    - Where (Dónde)
    - Why (Por qué)
    - How (Cómo)
  
  steps:
    - Leer texto completo
    - Identificar respuesta a cada pregunta
    - Extraer información clave
    - Estructurar resumen en formato 5W1H
    - Añadir conclusión breve
  
  template: |
    ## Resumen 5W1H
    
    **Who:** [Quién está involucrado]
    **What:** [Qué sucedió/se discute]
    **When:** [Cuándo ocurrió]
    **Where:** [Dónde tuvo lugar]
    **Why:** [Por qué es importante]
    **How:** [Cómo se desarrolló]
    
    **Conclusión:** [1-2 oraciones]
```

---

## Tipo 3: Context-Aware Skills ⭐ NEW

### Definición
Skills que **apuntan a documentos/contexto** en el RAG para que el agente obtenga información.

### Conexión con RAG Jerárquico

```
Skill Bank ←──→ Document RAG
    ↓               ↓
Skills       Documents (indexed)
    ↓               ↓
Apunta a ────→ Sección específica
```

### Ejemplo 1: answer_from_terms_and_conditions

```yaml
id: answer_from_terms_and_conditions
skillType: context_aware
usesTools: []
referencesDocuments: [terms_and_conditions]  # ← Conecta con RAG

overview: |
  Responde preguntas sobre términos y condiciones del servicio.
  Usa el RAG de documentos para encontrar secciones relevantes.

instructions:
  steps:
    - Analizar la pregunta del usuario
    - Identificar tema principal (refunds, privacy, cancellation, etc)
    - Buscar en documento terms_and_conditions usando RAG
    - Filtrar por sección relevante (ej: "Section 7: Refund Policy")
    - Leer contexto completo de esa sección
    - Formular respuesta basada en texto oficial
    - Citar sección específica para transparencia
  
  documentStructure:
    docId: terms_and_conditions
    sections:
      - id: sec-1, title: "Account Terms"
      - id: sec-2, title: "Privacy Policy"
      - id: sec-3, title: "Payment Terms"
      - id: sec-7, title: "Refund Policy"
      - id: sec-9, title: "Cancellation Policy"
  
  queryExamples:
    - user_question: "¿Puedo obtener reembolso?"
      search_query: "refund policy terms"
      target_section: "sec-7"
      filter: { doc_id: "terms_and_conditions", level: 2 }
    
    - user_question: "¿Cómo cancelo mi suscripción?"
      search_query: "cancel subscription"
      target_section: "sec-9"
  
  bestPractices:
    - Siempre citar la sección específica de T&C
    - Si no está en T&C, decir explícitamente "no cubierto"
    - Usar lenguaje del documento original, no parafrasear
    - Incluir link a sección completa si disponible

ragIntegration:
  # Integración con RAG existente
  endpoint: /api/query/smart
  method: POST
  body:
    query: "[search_query from user question]"
    k: 3
    filters:
      doc_id: terms_and_conditions
      level: 2
```

**Características:**
- ✅ Conecta con RAG de documentos existente
- ✅ No ejecuta tools, solo consulta documentos
- ✅ Usa búsqueda semántica del RAG
- ✅ Puede filtrar por sección jerárquica
- ✅ Proporciona método de búsqueda

### Ejemplo 2: find_in_knowledge_base

```yaml
id: find_in_knowledge_base
skillType: context_aware
referencesDocuments: [product_docs, faq, troubleshooting]

overview: |
  Busca información en la base de conocimiento interna.
  Combina RAG semántico + filtrado jerárquico.

instructions:
  steps:
    - Clasificar tipo de pregunta (product, faq, troubleshooting)
    - Seleccionar documento apropiado
    - Generar query de búsqueda semántica
    - Usar RAG con filtros jerárquicos
    - Si respuesta en nivel H2, incluir contexto H1 (parent)
    - Si respuesta parcial, buscar en siblings
    - Combinar múltiples secciones si necesario
  
  documentMapping:
    product_questions: product_docs
    how_to_questions: faq
    error_questions: troubleshooting
  
  ragStrategy:
    # Aprovechar jerarquía del RAG
    initial_search:
      - Vector search con k=5
      - Filtrar por doc_id según tipo de pregunta
    
    context_expansion:
      - Obtener parent section (H1) para contexto
      - Obtener siblings para información relacionada
      - Usar graph edges si disponible
```

---

## Tipo 4: Hybrid Skills

### Definición
Skills que **combinan** tools + instrucciones + contexto.

### Ejemplo: customer_support_response

```yaml
id: customer_support_response
skillType: hybrid
usesTools: [http_request]
referencesDocuments: [support_knowledge_base]
nativeCapabilities: [text_generation, empathy]

overview: |
  Responde tickets de soporte combinando:
  - Búsqueda en knowledge base (RAG)
  - Consulta de datos del cliente (API)
  - Generación de respuesta empática (LLM nativo)

instructions:
  steps:
    # 1. Context-aware: Buscar en docs
    - Analizar ticket del cliente
    - Buscar solución en knowledge base usando RAG
    - Obtener artículos relevantes
    
    # 2. Tool-based: Consultar API
    - Usar http_request para obtener datos del cliente
    - Verificar estado de cuenta, historial, etc
    
    # 3. Instructional: Generar respuesta
    - Combinar información de KB + datos del cliente
    - Generar respuesta empática usando LLM nativo
    - Seguir tono de marca (amigable, profesional)
    - Incluir links a artículos relevantes
    
  template: |
    Hola [Customer Name],
    
    Gracias por contactarnos. [Empatía con el problema]
    
    [Solución basada en KB]
    
    [Datos específicos del cliente si aplican]
    
    Puedes encontrar más información aquí: [Links]
    
    ¿Hay algo más en lo que pueda ayudarte?
```

---

## Integración con RAG Jerárquico Existente

### Arquitectura Unificada

```
┌──────────────────────────────────────────────────────────┐
│                    Skill Bank                            │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Skills                                                  │
│   ├─ Tool-based ──> Tools                               │
│   ├─ Instructional (self-contained)                     │
│   ├─ Context-aware ──> Documents (RAG) ─┐               │
│   └─ Hybrid ──> Tools + Documents       │               │
│                                         │               │
└─────────────────────────────────────────┼───────────────┘
                                          │
                                          ▼
                    ┌─────────────────────────────────────┐
                    │      Document RAG (Existing)        │
                    ├─────────────────────────────────────┤
                    │  - Vector search                    │
                    │  - Hierarchical structure           │
                    │  - Graph expansion                  │
                    │  - Parent/Sibling context           │
                    └─────────────────────────────────────┘
```

### Nuevo Campo en Skill Type

```typescript
interface Skill {
  // ... campos existentes ...
  
  skillType: 'tool_based' | 'instructional' | 'context_aware' | 'hybrid';
  
  // Para tool-based
  usesTools?: string[];
  
  // Para instructional
  nativeCapabilities?: string[];  // text_generation, summarization, etc
  methodology?: string;           // Método a seguir
  template?: string;              // Plantilla/formato
  
  // Para context-aware
  referencesDocuments?: string[]; // IDs de documentos en RAG
  ragIntegration?: {
    endpoint: string;
    filters?: Record<string, any>;
    strategy?: string;
  };
  
  // Metadata
  requiresExternalServices?: boolean;  // false para instructional
}
```

---

## Ventajas por Tipo de Skill

### Tool-Based
- ✅ Interactúa con mundo externo
- ✅ Automatiza tareas
- ❌ Requiere credentials
- ❌ Puede fallar (servicios externos)

### Instructional
- ✅ Siempre disponible (no depende de servicios)
- ✅ No requiere credentials
- ✅ Usa capacidades nativas del LLM
- ✅ Rápido (no network calls)
- ❌ Limitado a lo que el LLM puede hacer

### Context-Aware
- ✅ Conecta con knowledge base existente
- ✅ Respuestas basadas en documentos oficiales
- ✅ Aprovecha RAG jerárquico
- ✅ Citable y verificable
- ❌ Limitado a información en documentos

### Hybrid
- ✅ Máxima flexibilidad
- ✅ Combina lo mejor de todos
- ❌ Más complejo de diseñar

---

## Ejemplos de Skills por Categoría

### Instructional Skills (No Tools)

```yaml
- create_cornell_notes
- summarize_with_5w1h
- write_executive_summary
- structure_essay_5_paragraphs
- create_mind_map
- apply_pareto_analysis
- use_swot_framework
- brainstorm_with_scamper
```

### Context-Aware Skills (RAG)

```yaml
- answer_from_terms_and_conditions
- find_in_product_documentation
- search_company_policies
- reference_legal_documents
- lookup_technical_specs
- consult_best_practices_guide
```

### Hybrid Skills (Tools + Context + Native)

```yaml
- customer_support_response     (KB + API + Generation)
- research_and_report           (Web + Docs + Summarization)
- code_review_with_standards    (Code Analysis + Style Guide + Suggestions)
```

---

## Discovery: Cómo el Agente Elige

```typescript
// Agente recibe: "Crear notas tipo Cornell de este texto"

await skillBank.discover({
  query: "crear notas cornell"
});

// Retorna
{
  skills: [
    {
      skill: { id: "create_cornell_notes", skillType: "instructional" },
      relevance: 0.95
    }
  ]
}

// Agente ve que es instructional
// Lee methodology y template
// Usa su LLM nativo para generar las notas
// No ejecuta ninguna tool externa ✅
```

```typescript
// Agente recibe: "¿Puedo obtener reembolso?"

await skillBank.discover({
  query: "política de reembolsos términos condiciones"
});

// Retorna
{
  skills: [
    {
      skill: { 
        id: "answer_from_terms_and_conditions",
        skillType: "context_aware",
        referencesDocuments: ["terms_and_conditions"]
      },
      relevance: 0.92
    }
  ]
}

// Agente ve que es context-aware
// Usa ragIntegration.endpoint para buscar
// Aplica filtros documentados
// Obtiene sección relevante del RAG
// Responde citando documento oficial ✅
```

---

## Conclusión

**Skill Bank evolucionó de "Tool Orchestration" a "Knowledge Augmentation"**

```
v1: Skills = Recetas para usar tools
    ↓
v2: Skills = Conocimiento estructurado que incluye:
    - Cómo usar tools (tool-based)
    - Cómo usar capacidades nativas (instructional)
    - Dónde encontrar información (context-aware)
    - Combinaciones (hybrid)
```

**Beneficios:**
- ✅ Máxima flexibilidad
- ✅ Integra con RAG existente
- ✅ Skills que no requieren servicios externos
- ✅ Aprovecha LLM nativo cuando es apropiado
- ✅ Mantiene separación de concerns

**Key Insight:** Las skills documentan **todo tipo de conocimiento útil**, no solo orquestación de tools.

