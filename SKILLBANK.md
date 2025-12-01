# Skill Bank - Meta-Tool para Agentes

Sistema experimental de descubrimiento y ejecución de capacidades para agentes AI. El Skill Bank permite a un agente descubrir dinámicamente qué puede hacer y cómo hacerlo mediante búsqueda semántica y grafo de relaciones.

## Concepto

El Skill Bank es una **meta-tool unificada** - la única herramienta que necesita un agente. A través de ella:

### Analogía con n8n / Make 🔄

Si conoces herramientas de automatización como **n8n** o **Make** (Integromat), el concepto es familiar:

| Skill Bank | n8n / Make | Descripción |
|------------|------------|-------------|
| **Tool** | **Node / Module** | Capacidad atómica (HTTP Request, Database Query) |
| **Skill** | **Workflow / Scenario** | Combinación ordenada para tarea completa |
| **Discovery** | **Template Search** | Buscar workflow apropiado |

**Diferencia clave:** n8n es para humanos (visual, no-code). Skill Bank es para agentes AI (semantic search, autodiscovery).

Ver [comparación detallada](docs/SKILLBANK_VS_N8N.md).

### Arquitectura

1. **Descubre** capacidades (tools) y recetas de uso (skills)
2. **Ejecuta** tools y skills para completar tareas
3. **Aprende** relaciones entre capacidades via grafo

```
┌─────────────────────────────────────────────────────────────┐
│                      AGENTE                                 │
│                         │                                   │
│                         ▼                                   │
│              ┌─────────────────────┐                        │
│              │    SKILL BANK       │  <-- Única tool        │
│              │    (meta-tool)      │                        │
│              └─────────────────────┘                        │
│                    │         │                              │
│           ┌────────┘         └────────┐                     │
│           ▼                           ▼                     │
│    ┌─────────────┐            ┌─────────────┐              │
│    │  DISCOVER   │            │   EXECUTE   │              │
│    │             │            │             │              │
│    │ - tools     │            │ - run tool  │              │
│    │ - skills    │            │ - run skill │              │
│    │ - relations │            │   workflow  │              │
│    └─────────────┘            └─────────────┘              │
│           │                           │                     │
│           └───────────┬───────────────┘                     │
│                       ▼                                     │
│              ┌─────────────────────┐                        │
│              │   RAG + GRAFO       │                        │
│              │                     │                        │
│              │  Tools ←──→ Skills  │                        │
│              │     ↑    ↓    ↑     │                        │
│              │     └────┴────┘     │                        │
│              └─────────────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

## Diferencia: Tools vs Skills

| Concepto | Definición | Ejemplo |
|----------|------------|---------|
| **Tool** | Capacidad ejecutable del sistema | `http_request`, `file_write`, `code_executor` |
| **Skill** | Receta de cómo usar tools para lograr objetivo | `stripe_api_handler` (usa `http_request`) |

### Analogía

- **Tool** = Martillo, sierra, destornillador (herramientas)
- **Skill** = Manual de instrucciones para construir una mesa (receta que usa las herramientas)

## Quick Start

### 1. Ejecutar Demo

```bash
# Registrar tools y skills de ejemplo
npx tsx examples/demo-skillbank.ts
```

Esto:
- Registra 3 tools: `http_request`, `file_write`, `code_executor`
- Registra 4 skills: `stripe_api_handler`, `pdf_report_generator`, `data_fetcher`, `email_sender`
- Crea relaciones en el grafo
- Prueba descubrimiento de capacidades

### 2. Iniciar API Server

```bash
npm run server
```

El servidor incluye endpoints del Skill Bank:
- `POST /api/skillbank/discover` - Descubrir tools/skills
- `POST /api/skillbank/execute` - Ejecutar tool/skill
- `GET /api/skillbank/tools` - Listar todas las tools
- `GET /api/skillbank/skills` - Listar todas las skills

### 3. Probar Discovery

```bash
curl -X POST http://localhost:3000/api/skillbank/discover \
  -H "Content-Type: application/json" \
  -d '{
    "query": "verificar pagos en stripe y generar reporte",
    "expandGraph": true,
    "k": 5
  }'
```

Respuesta:
```json
{
  "query": "verificar pagos en stripe y generar reporte",
  "tools": [
    {
      "tool": { "id": "http_request", "name": "HTTP Request", ... },
      "relevance": 0.85,
      "source": "vector"
    }
  ],
  "skills": [
    {
      "skill": { "id": "stripe_api_handler", "name": "Stripe API Handler", ... },
      "relevance": 0.94,
      "compatibility": 1.0,
      "source": "vector"
    },
    {
      "skill": { "id": "pdf_report_generator", ... },
      "relevance": 0.88,
      "compatibility": 1.0,
      "source": "graph"
    }
  ],
  "suggestedFlow": {
    "steps": [
      { "entityId": "stripe_api_handler", "order": 0 },
      { "entityId": "pdf_report_generator", "order": 1 }
    ]
  }
}
```

## Anatomía de una Tool

```yaml
# data/tools/http_request.yaml
id: http_request
name: HTTP Request
type: tool
category: http
description: |
  Realiza peticiones HTTP a cualquier endpoint externo.
  Soporta GET, POST, PUT, DELETE con headers y body.

inputSchema:
  type: object
  properties:
    method: { type: string, enum: [GET, POST, PUT, DELETE] }
    url: { type: string }
    headers: { type: object }
    body: { type: object }
  required: [method, url]

outputSchema:
  type: object
  properties:
    status: { type: number }
    body: { type: any }
    headers: { type: object }

implementation:
  type: internal
  ref: executor/http

examples:
  - description: GET request simple
    input: { method: GET, url: https://api.example.com }
    expectedOutput: { status: 200, body: [...] }

limitations:
  - Timeout de 30 segundos por defecto
  - No soporta uploads > 10MB
```

## Anatomía de una Skill

```yaml
# data/skills/stripe_api_handler.yaml
id: stripe_api_handler
name: Stripe API Handler
type: skill
category: api
usesTools: [http_request]

overview: |
  Interactua con Stripe API para pagos y clientes.
  Usa http_request con autenticacion Bearer.

instructions:
  steps:
    - Obtener STRIPE_SECRET_KEY del entorno
    - Construir URL https://api.stripe.com/v1/{resource}
    - Configurar header Authorization Bearer {key}
    - Ejecutar http_request tool
    - Parsear respuesta JSON
  
  prerequisites:
    - STRIPE_SECRET_KEY configurada
    - Conexion a internet
  
  bestPractices:
    - Usar idempotency-key para writes
    - Cachear lecturas frecuentes
  
  antiPatterns:
    - NO loguear el API key
    - NO ignorar rate limits

parameters:
  - name: action
    type: string
    enum: [list_customers, create_charge, ...]
  
  - name: customerId
    type: string

outputs:
  - name: data
    type: object
  
  - name: requestId
    type: string

examples:
  - situation: Listar clientes
    input: { action: "list_customers" }
    expectedOutput: Array de Customer objects
```

## Grafo de Relaciones

El grafo conecta tools y skills con relaciones explícitas:

| Edge Type | Descripción | Ejemplo |
|-----------|-------------|---------|
| `ENABLES` | Tool habilita Skill | `http_request` ENABLES `stripe_api_handler` |
| `USES` | Skill usa Tool | `stripe_api_handler` USES `http_request` |
| `REQUIRES` | Skill requiere otra Skill | `pdf_report` REQUIRES `data_fetcher` |
| `PRODUCES_INPUT_FOR` | Output de A es input de B | `stripe_api` → `pdf_report` |
| `SIMILAR_TO` | Capacidades similares | `data_fetcher` ≈ `stripe_api` |
| `ALTERNATIVE_TO` | Intercambiables | `stripe_api` ⇄ `paypal_api` |
| `COMPLEMENTS` | Funcionan bien juntas | `email_sender` + `pdf_report` |

### Beneficios del Grafo

1. **Expansión de contexto**: Al encontrar `stripe_api_handler`, el grafo revela `pdf_report_generator` como complemento
2. **Flujos sugeridos**: El agente descubre secuencias típicas de skills
3. **Dependencias automáticas**: Si skill A REQUIRES B, el agente sabe que necesita ambas

## API del Skill Bank

### Discover

```typescript
POST /api/skillbank/discover

{
  "query": string,              // Qué necesita hacer
  "mode": "all" | "tools" | "skills",
  "expandGraph": boolean,       // Incluir relacionados
  "k": number                   // Max resultados
}

// Retorna
{
  "tools": DiscoveredTool[],
  "skills": DiscoveredSkill[],
  "suggestedFlow": FlowStep[]
}
```

### Execute

```typescript
POST /api/skillbank/execute

{
  "targetId": string,           // ID de tool o skill
  "targetType": "tool" | "skill",
  "input": object,
  "options": {
    "timeout": number,
    "retries": number,
    "dryRun": boolean
  }
}

// Retorna
{
  "success": boolean,
  "output": any,
  "toolsUsed": string[],
  "logs": Log[]
}
```

## CLI Tools

### Registrar Tool

```bash
# Registrar una tool
npx tsx src/cli/registerTool.ts data/tools/http_request.yaml

# Registrar todas las tools de un directorio
npx tsx src/cli/registerTool.ts --dir data/tools
```

### Registrar Skill

```bash
# Registrar una skill
npx tsx src/cli/registerSkill.ts data/skills/stripe_api_handler.yaml

# Registrar todas las skills de un directorio
npx tsx src/cli/registerSkill.ts --dir data/skills
```

### Crear Relaciones

```bash
# Crear edge en el grafo
npx tsx src/cli/linkEntities.ts <from_id> <to_id> <edge_type> [weight]

# Ejemplos
npx tsx src/cli/linkEntities.ts stripe_handler paypal_handler ALTERNATIVE_TO
npx tsx src/cli/linkEntities.ts report_gen data_fetcher REQUIRES 0.9
```

## Caso de Uso: Agente con Skill Bank

```python
# Pseudo-código de un agente usando Skill Bank

class Agent:
    def __init__(self):
        self.skillbank = SkillBankClient()
    
    def handle_request(self, user_request: str):
        # 1. Descubrir capacidades relevantes
        discovery = self.skillbank.discover(
            query=user_request,
            expandGraph=True
        )
        
        # 2. Analizar skills disponibles
        available_skills = [s for s in discovery.skills 
                          if s.compatibility == 1.0]
        
        # 3. Seguir flujo sugerido
        for step in discovery.suggestedFlow.steps:
            skill = self.skillbank.get_skill(step.entityId)
            
            # 4. Leer instrucciones de la skill
            print(f"Ejecutando: {skill.name}")
            print(f"Pasos: {skill.instructions.steps}")
            
            # 5. Usar tools según instrucciones
            for tool_id in skill.usesTools:
                result = self.skillbank.execute(
                    targetId=tool_id,
                    targetType="tool",
                    input={...}
                )
```

### Ejemplo Concreto

```
Usuario: "Necesito verificar los pagos de hoy en Stripe y enviar un reporte por email"

Agente:
  1. Descubre: stripe_api_handler, pdf_report_generator, email_sender
  2. Flujo sugerido: stripe_api → pdf_report → email_sender
  3. Lee stripe_api_handler.instructions:
     - Obtener STRIPE_SECRET_KEY
     - Usar http_request tool
     - Construir URL de Stripe
  4. Ejecuta http_request con parámetros de Stripe
  5. Obtiene datos de pagos
  6. Lee pdf_report_generator.instructions:
     - Usar code_executor con ReportLab
     - Usar file_write para guardar PDF
  7. Genera reporte PDF
  8. Lee email_sender.instructions:
     - Usar http_request con SendGrid API
  9. Envía email con reporte adjunto
  
✅ Tarea completada
```

## Estructura de Archivos

```
src/skills/
  types.ts                  # Tipos unificados
  skillBank.ts              # Meta-tool principal
  store/
    unifiedStore.ts         # Store para tools + skills
    graphIndex.ts           # Expansión de grafo (BFS)
  executor/
    toolExecutor.ts         # Ejecuta tools
    skillExecutor.ts        # Orquesta skills

src/cli/
  registerTool.ts           # CLI para tools
  registerSkill.ts          # CLI para skills
  linkEntities.ts           # CLI para relaciones

src/api/routes/
  skillbank.ts              # Endpoints REST

data/
  tools/                    # Tools YAML
    http_request.yaml
    file_write.yaml
    code_executor.yaml
  
  skills/                   # Skills YAML
    stripe_api_handler.yaml
    pdf_report_generator.yaml
    data_fetcher.yaml
    email_sender.yaml
```

## Principio de Diseño Clave: Tools Atómicas 🎯

### La Regla de Oro

> **Tools deben ser lo más atómicas/genéricas posible. Skills contienen el conocimiento específico de CÓMO usarlas.**

### ❌ Anti-Pattern: Tools Específicas

```yaml
# INCORRECTO - 4 tools muy similares
tools:
  - create_db_record
  - read_db_record  
  - update_db_record
  - delete_db_record
```

**Problemas:**
- Baja diversidad vectorial (embeddings muy similares)
- Difícil mantener (4 implementaciones parecidas)
- El agente se confunde entre tools tan parecidas

### ✅ Pattern Correcto: Tool Atómica + Skills Específicas

```yaml
# CORRECTO - 1 tool genérica
tools:
  - db_query  # Ejecuta cualquier SQL

# 4 skills con contexto rico
skills:
  - create_user        # Usa db_query con INSERT
  - delete_user        # Usa db_query con UPDATE (soft delete)
  - get_user_by_email  # Usa db_query con SELECT
  - update_user_password  # Usa db_query con UPDATE
```

**Ventajas:**
- ✅ **Alta diversidad vectorial** → Cada skill tiene embedding único
- ✅ **Contexto rico** → Skills incluyen validaciones, best practices, anti-patterns
- ✅ **Fácil mantener** → 1 tool, N skills
- ✅ **Mejor discovery** → El agente encuentra exactamente lo que necesita

### Ejemplo Concreto

**Query del agente:** "crear un nuevo usuario en la base de datos"

Con tools específicas:
```
Resultados:
1. create_db_record (0.85) ← Genérico
2. insert_into_table (0.83) ← Genérico
❌ Ninguno menciona usuarios, validaciones, o dominio
```

Con tool atómica + skills:
```
Resultados:
1. create_user (0.94) ← Específico, contexto de usuarios
2. register_new_account (0.89) ← Relacionado
✅ Mucho más relevante
```

### Conexión con RAG Jerárquico

Este principio se alinea perfectamente con el RAG jerárquico que **prioriza diversidad vectorial**:

- **Tools específicas**: Embeddings similares → difícil distinguir
- **Skills específicas**: Embeddings diversos → mejor retrieval

Ver [docs/SKILLBANK_DESIGN_PRINCIPLES.md](docs/SKILLBANK_DESIGN_PRINCIPLES.md) para análisis completo.

## Ecosistema Completo: 6 Layers 🌟

El Skill Bank integra **6 capas** que trabajan juntas:

```
Layer 6: Memory & Learning ⭐ → Aprende y personaliza
Layer 5: Documents 📚        → Proporciona contexto
Layer 4: Sub-Agents 🤖       → Especializa y delega
Layer 3: Credentials 🔐      → Asegura y audita
Layer 2: Skills              → Estructura conocimiento
Layer 1: Tools               → Ejecuta acciones
```

**Componentes:**

1. **Tools** - Capacidades atómicas ejecutables (http_request, db_query) ✅
2. **Skills** - Conocimiento estructurado (4 tipos) ✅
3. **Credentials** 🔐 - Gestión segura con vault (Q2 2025)
4. **Sub-Agents** 🤖 - Especialización y delegación (Q3 2025)
5. **Documents** 📚 - Base de conocimiento vía RAG (integrado) ✅
6. **Memory & Learning** ⭐ - Personalización y mejora continua (Q4 2025)

Ver arquitectura completa: [docs/SKILLBANK_COMPLETE_ARCHITECTURE.md](docs/SKILLBANK_COMPLETE_ARCHITECTURE.md)

Ver roadmap y evolución: [docs/SKILLBANK_FULL_STACK.md](docs/SKILLBANK_FULL_STACK.md)

## Tipos de Skills 📚

El Skill Bank soporta **4 tipos de skills**, no solo orquestación de tools:

### 1. Tool-Based Skills (Original)
Orquestan tools externas para ejecutar acciones.

```yaml
skill: stripe_api_handler
skillType: tool_based
usesTools: [http_request]
```

### 2. Instructional Skills ⭐
Proporcionan metodología para que el agente use sus **capacidades nativas**.

```yaml
skill: create_cornell_notes
skillType: instructional
usesTools: []  # No tools!
nativeCapabilities: [text_generation, structuring]

# El agente usa su LLM nativo, no ejecuta tools externas
```

**Ejemplo:** Crear notas Cornell, resumir con 5W1H, estructurar essays.

### 3. Context-Aware Skills ⭐
Apuntan a **documentos en el RAG** existente para obtener información.

```yaml
skill: answer_from_terms_and_conditions
skillType: context_aware
usesTools: []
referencesDocuments: [terms_and_conditions]

# Conecta con el RAG de documentos ya implementado
# Usa búsqueda semántica + filtrado jerárquico
```

**Ejemplo:** Responder desde T&C, buscar en knowledge base, consultar políticas.

### 4. Hybrid Skills
Combinan tools + instrucciones + contexto.

```yaml
skill: customer_support
skillType: hybrid
usesTools: [http_request]
referencesDocuments: [support_kb]
nativeCapabilities: [text_generation]
```

**Ver documentación completa:** [docs/SKILLBANK_SKILL_TYPES.md](docs/SKILLBANK_SKILL_TYPES.md)

**Beneficios:**
- ✅ No todas las skills requieren tools externas
- ✅ Conecta con RAG jerárquico existente
- ✅ Aprovecha capacidades nativas del LLM
- ✅ Máxima flexibilidad

## Extensiones Futuras 🚀

El Skill Bank tiene un roadmap de extensiones enterprise-grade documentado en [docs/SKILLBANK_EXTENSIONS.md](docs/SKILLBANK_EXTENSIONS.md):

### 1. Credentials Vault 🔐 (Planeado Q2 2025)

**Problema:** Actualmente las credentials están en environment variables, accesibles globalmente.

**Solución:** Nueva entidad `Credential` con:
- Local vault encrypted (file, OS keychain, HashiCorp Vault)
- Principle of least privilege (skills específicas pueden acceder a credentials específicas)
- Audit trail completo de uso
- Rotation policies automáticas

```yaml
# Ejemplo
credential:
  id: stripe_api_key
  allowedSkills: [stripe_api_handler, stripe_payment]
  vaultPath: vault://stripe/api_key
  
skill:
  id: stripe_api_handler
  requiresCredentials: [stripe_api_key]
```

**Beneficios:**
- ✅ Security by default
- ✅ Auditable
- ✅ Rotatable sin cambiar código
- ✅ Scoped access

### 2. Sub-Agents 🤖 (Q3 2025)

**Problema:** Agentes ejecutan todo secuencialmente, no hay especialización ni delegación.

**Solución:** Nueva entidad `Agent` con:
- Especialización por dominio (analytics, communication, data)
- Delegación de tareas a agentes especializados
- Solicitud de información entre agentes
- Ejecución paralela de tareas

```yaml
# Ejemplo
agent:
  id: analytics_agent
  specialization: [data_analysis, sql]
  availableSkills: [analyze_sales, generate_insights]
  
# Main agent delega
main_agent:
  task: "Analizar ventas"
  discovers: analyze_sales skill
  delegates_to: analytics_agent
```

**Beneficios:**
- ✅ Horizontal scaling (múltiples agentes)
- ✅ Especialización (mejor en su dominio)
- ✅ Paralelización (tasks simultáneas)
- ✅ Fault isolation (fallo de un agente no afecta otros)

### Modelo de Grafo Extendido

```
Actual:
  TOOL ←→ SKILL

Extendido:
  TOOL ←→ SKILL ←→ CREDENTIAL
                ←→ AGENT
  
  AGENT ←→ AGENT (delegación)
  AGENT ←→ CREDENTIAL (acceso)
```

Ver documentación completa en [docs/SKILLBANK_EXTENSIONS.md](docs/SKILLBANK_EXTENSIONS.md).

## Context-Aware Skills + RAG Integration ✅ (Implemented)

Skills que aprovechan tu base de conocimiento de documentos existente para proporcionar respuestas basadas en contexto real.

**Cómo funciona:**
1. **Context-aware skill** define documentos a consultar
2. **RAG engine** busca información relevante
3. **Skill instructions** guían al agente en cómo usar el contexto
4. **Agent** genera respuesta basada en documentos reales

**Ejemplo: Legal Q&A**

```typescript
// 1. Discover skill for legal question
const discovery = await skillBank.discover({
  query: "¿Cuál es la política de cancelación?",
  mode: 'all',
  k: 3
});

// 2. Execute context-aware skill
const result = await skillBank.execute({
  targetId: 'answer_from_legal_docs',
  targetType: 'skill',
  input: { query: "¿Cuál es la política de cancelación?" }
});

// 3. Skill returns RAG context + instructions
// Agent uses context to answer accurately
```

**Skills context-aware disponibles:**
- `answer_from_legal_docs` - Legal documents Q&A
- `extract_product_info` - Product catalog information
- `summarize_technical_docs` - Technical documentation summaries (hybrid)

---

## Execution Tracking ✅ (Implemented)

Cada ejecución de skill se registra automáticamente para analytics y futura personalización.

**Qué se registra:**
- Skill ejecutada
- Input y output
- Tiempo de ejecución
- Éxito/error
- Timestamp

**Analytics disponibles:**

```bash
# Recent executions
GET /api/skillbank/analytics/executions?limit=10

# Overall statistics
GET /api/skillbank/analytics/stats

# Top skills más usadas
GET /api/skillbank/analytics/top-skills?limit=10

# Specific execution
GET /api/skillbank/analytics/executions/:id
```

**Ejemplo de stats:**

```json
{
  "total": 47,
  "bySkill": {
    "answer_from_legal_docs": 15,
    "stripe_api_handler": 12,
    "pdf_report_generator": 8
  },
  "byType": {
    "context_aware": 15,
    "tool_based": 25,
    "hybrid": 7
  },
  "successRate": 0.94,
  "averageExecutionTime": 234
}
```

**Demo:**

```bash
npm run demo:rag
```

---

### 3. Memory & Learning ⭐ (Q4 2025)

**Problema:** El agente "olvida" entre sesiones, pregunta lo mismo siempre.

**Solución:** Sistema de memoria y aprendizaje por usuario:
- **User Identity**: ID único por usuario
- **Conversational Memory**: Contexto persistente por sesión
- **Execution History**: Qué se ejecutó y cómo
- **User Preferences**: Aprendizaje automático de preferencias
- **Pattern Detection**: Optimización continua

```typescript
// Primera vez
User: "Genera reporte de ventas"
Agent: [hace 5 preguntas sobre formato, destinatarios, etc]

// Después de varias ejecuciones
User: "Genera reporte de ventas"  
Agent: "OK, PDF con gráficos como siempre. Enviando..." ✓
```

**Beneficios:**
- ✅ Menos preguntas repetitivas
- ✅ Ejecución más rápida (no setup cada vez)
- ✅ Personalización por usuario (User A ≠ User B)
- ✅ Mejora continua (aprende con cada uso)

Ver [docs/SKILLBANK_MEMORY_AND_LEARNING.md](docs/SKILLBANK_MEMORY_AND_LEARNING.md).

## Roadmap

### Implementado ✅

- [x] Sistema de tipos unificado (Tool, Skill)
- [x] Store con vector search + grafo
- [x] Discover con expansión de grafo
- [x] Execute para tools y skills
- [x] CLI para registrar entities
- [x] API REST completa
- [x] Tools y skills de ejemplo
- [x] Demo funcional

### Próximos Pasos 🚧

1. **Tool Handlers Reales**
   - Implementar ejecutores para http_request, file_write, code_executor
   - Sandbox seguro para ejecución de código

2. **Skill Auto-Execution**
   - Interpretar instrucciones con LLM
   - Ejecutar skills automáticamente (no solo retornar instrucciones)

3. **Learning & Feedback**
   - Trackear qué skills se usan juntas
   - Sugerir nuevas relaciones basado en patrones de uso

4. **Skill Composition**
   - Crear nuevas skills combinando existentes
   - Validar compatibilidad de composiciones

5. **Tool Marketplace**
   - Importar/exportar tools y skills
   - Compartir entre equipos

## Ventajas del Skill Bank

### vs. Tools Estáticas del Agente

| Approach | Skills del Agente | Skill Bank |
|----------|-------------------|------------|
| **Discoverability** | Agente debe conocer todas sus tools de antemano | Agente descubre dinámicamente qué puede hacer |
| **Escalabilidad** | Difícil añadir nuevas tools (requiere reconfigurar agente) | Registrar nueva tool/skill es trivial |
| **Contexto** | Tool description limitada | Skill con instrucciones ricas, ejemplos, best practices |
| **Relaciones** | No hay info de cómo combinar tools | Grafo sugiere flujos y dependencias |
| **Flexibility** | Set fijo de tools | Capacidades crecen con el banco |

### Caso Real: GitHub Copilot Workspace

GitHub Copilot Workspace usa un concepto similar:
- Tiene un "banco" de capacidades (edit file, run tests, etc)
- El agente descubre qué capacidades usar según el task
- Compone flujos de múltiples capacidades

Skill Bank generaliza este patrón para cualquier dominio.

## Licencia

MIT

