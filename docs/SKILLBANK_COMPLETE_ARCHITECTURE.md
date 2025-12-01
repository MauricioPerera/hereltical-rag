# Skill Bank - Arquitectura Completa

## Visión General del Ecosistema

El Skill Bank es un sistema completo de **knowledge augmentation** que integra:

1. **Tools** - Capacidades atómicas ejecutables
2. **Skills** - Conocimiento estructurado (4 tipos)
3. **Credentials** - Gestión segura de acceso
4. **Agents** - Sub-agentes especializados
5. **Documents** - Base de conocimiento (RAG)
6. **Memory & Learning** ⭐ - Personalización y mejora continua

```
┌───────────────────────────────────────────────────────────────┐
│                        SKILL BANK                             │
│                      (Meta-Tool Unificada)                    │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐        │
│  │    TOOLS    │   │   SKILLS    │   │ CREDENTIALS │        │
│  │             │   │  (4 tipos)  │   │   (vault)   │        │
│  │ http_req    │   │ tool-based  │   │ stripe_key  │        │
│  │ db_query    │   │instructional│   │ github_tok  │        │
│  │ file_write  │   │context-aware│   │ db_passwd   │        │
│  └──────┬──────┘   │   hybrid    │   └──────┬──────┘        │
│         │          └──────┬──────┘          │               │
│         │                 │                 │               │
│         └─────────────────┼─────────────────┘               │
│                           │                                 │
│  ┌─────────────┐   ┌──────┴──────┐   ┌─────────────┐       │
│  │  AGENTS     │   │  DISCOVERY  │   │  DOCUMENTS  │       │
│  │ (sub-agents)│   │   (RAG +    │   │    (RAG)    │       │
│  │             │   │    Graph)   │   │             │       │
│  │ analytics   │   └─────────────┘   │ terms_cond  │       │
│  │ payment     │                     │ prod_docs   │       │
│  │ support     │                     │ knowledge   │       │
│  └─────────────┘                     └─────────────┘       │
│                                                             │
│  ┌───────────────────────────────────────────────────┐     │
│  │           MEMORY & LEARNING LAYER ⭐               │     │
│  ├───────────────────────────────────────────────────┤     │
│  │ • User Identity (por usuario)                     │     │
│  │ • Conversational Memory (contexto)                │     │
│  │ • Execution History (qué se hizo)                 │     │
│  │ • User Preferences (aprendizaje)                  │     │
│  │ • Pattern Detection (optimización)                │     │
│  └───────────────────────────────────────────────────┘     │
│                                                             │
└───────────────────────────────────────────────────────────────┘
```

---

## 1. Tools (Capacidades Atómicas)

### Definición
Capacidades ejecutables genéricas y reutilizables.

```yaml
tool: http_request
category: http
inputSchema: { method, url, headers, body }
```

**Características:**
- Máxima atomicidad
- Genéricas (no específicas de dominio)
- Reutilizables por múltiples skills

---

## 2. Skills (Conocimiento Estructurado)

### Tipo 1: Tool-Based
Orquestan tools externas.

```yaml
skill: stripe_api_handler
skillType: tool_based
usesTools: [http_request]
requiresCredentials: [stripe_api_key]  ← Conecta con Vault
```

### Tipo 2: Instructional
Usan capacidades nativas del LLM.

```yaml
skill: create_cornell_notes
skillType: instructional
usesTools: []
nativeCapabilities: [text_generation, structuring]
```

### Tipo 3: Context-Aware
Conectan con documentos en RAG.

```yaml
skill: answer_from_terms
skillType: context_aware
referencesDocuments: [terms_and_conditions]  ← Conecta con RAG
```

### Tipo 4: Hybrid
Combinan todo.

```yaml
skill: customer_support
skillType: hybrid
usesTools: [http_request]
referencesDocuments: [support_kb]
requiresCredentials: [crm_api_key]
canDelegateTo: [support_agent]  ← Conecta con Sub-Agents
```

---

## 3. Credentials (Gestión Segura)

### Propósito
Gestión de credenciales con **principle of least privilege**.

```yaml
credential:
  id: stripe_api_key
  service: stripe
  vaultPath: vault://stripe/api_key
  allowedSkills: [stripe_api_handler, stripe_payment]  ← Scoped
  allowedAgents: [payment_agent]  ← También para agents
```

### Arquitectura

```
Skill/Agent solicita credential
         ↓
Skill Bank verifica permissions
         ↓
Si autorizado → Desencripta del vault
         ↓
Inyecta en ejecución (temporal)
         ↓
Loguea uso (audit trail)
         ↓
Credential destruida después de uso
```

**Beneficios:**
- ✅ Cada skill/agent solo accede a lo que necesita
- ✅ Audit trail completo
- ✅ Credentials rotables sin cambiar código
- ✅ Soporta múltiples vault providers

---

## 4. Sub-Agents (Especialización)

### Propósito
Agentes especializados que pueden ejecutar skills específicas.

```yaml
agent:
  id: analytics_agent
  specialization: [data_analysis, sql]
  availableSkills: [analyze_sales, generate_insights]
  endpoint: http://localhost:3001
  requiresCredentials: [db_password]  ← Tiene sus credentials
```

### Flujo de Delegación

```
Main Agent: "Analizar ventas y notificar"
     ↓
Skill Bank Discovery:
  - analyze_sales → BEST_HANDLED_BY analytics_agent
  - send_email → BEST_HANDLED_BY notification_agent
     ↓
Main Agent decide delegar:
     ↓
  ┌─────────────────────────────────┐
  │  analytics_agent.execute()       │
  │  - Tiene credential: db_password │
  │  - Ejecuta: analyze_sales        │
  │  - Retorna: insights data        │
  └─────────────────────────────────┘
     ↓
Main Agent recibe data
     ↓
  ┌─────────────────────────────────┐
  │  notification_agent.execute()    │
  │  - Tiene credential: smtp_key    │
  │  - Ejecuta: send_email           │
  │  - Retorna: sent confirmation    │
  └─────────────────────────────────┘
     ↓
Main Agent completa tarea ✅
```

**Beneficios:**
- ✅ Especialización por dominio
- ✅ Horizontal scaling (múltiples agentes)
- ✅ Paralelización de tareas
- ✅ Fault isolation
- ✅ Cada agente tiene sus propias credentials

---

## 5. Documents (Base de Conocimiento)

### Propósito
Documentos indexados en el RAG jerárquico existente.

```yaml
document:
  docId: terms_and_conditions
  title: Terms and Conditions
  sections:
    - sec-1: Account Terms
    - sec-2: Privacy Policy
    - sec-7: Refund Policy
```

### Skills → Documents

```yaml
skill: answer_from_terms
skillType: context_aware
referencesDocuments: [terms_and_conditions]
ragIntegration:
  endpoint: /api/query/smart
  filters: { doc_id: "terms_and_conditions" }
```

**Beneficios:**
- ✅ Conecta con RAG existente
- ✅ Búsqueda semántica + jerárquica
- ✅ Citable y verificable
- ✅ Aprovecha parent/sibling context

---

## Modelo de Grafo Completo

```
TOOL ←──ENABLES──→ SKILL
  ↑                  ↓
  │              REQUIRES_CREDENTIAL
  │                  ↓
  │              CREDENTIAL
  │                  ↓
  │              HAS_ACCESS_TO
  │                  ↓
AGENT ←──CAN_EXECUTE──→ SKILL
  ↓                     ↓
DELEGATES_TO      REFERENCES_DOCUMENT
  ↓                     ↓
AGENT              DOCUMENT (RAG)
```

### Tipos de Edges

| Edge Type | From → To | Significado |
|-----------|-----------|-------------|
| **ENABLES** | Tool → Skill | Tool habilita Skill |
| **USES** | Skill → Tool | Skill usa Tool |
| **REQUIRES_CREDENTIAL** | Skill → Credential | Skill necesita Credential |
| **HAS_ACCESS_TO** | Agent → Credential | Agent tiene acceso |
| **CAN_EXECUTE** | Agent → Skill | Agent puede ejecutar |
| **DELEGATES_TO** | Agent → Agent | Delegación |
| **BEST_HANDLED_BY** | Skill → Agent | Mejor agente para skill |
| **REFERENCES_DOCUMENT** | Skill → Document | Skill apunta a doc |

---

## Ejemplo Completo: E2E Flow

### Tarea
Usuario: "Analizar pagos de Stripe del mes y enviar reporte al equipo"

### Paso 1: Discovery

```typescript
await skillBank.discover({
  query: "analizar pagos stripe generar reporte enviar email"
});

// Retorna:
{
  skills: [
    {
      skill: "stripe_payment_analysis",
      type: "hybrid",
      usesTools: ["http_request"],
      requiresCredentials: ["stripe_api_key"],
      referencesDocuments: ["payment_policies"],
      bestHandledBy: "analytics_agent"
    },
    {
      skill: "generate_pdf_report",
      type: "tool_based",
      usesTools: ["code_executor", "file_write"],
      bestHandledBy: "report_agent"
    },
    {
      skill: "send_email_with_attachment",
      type: "tool_based",
      usesTools: ["http_request"],
      requiresCredentials: ["sendgrid_api_key"],
      bestHandledBy: "notification_agent"
    }
  ],
  suggestedAgents: [
    "analytics_agent",
    "report_agent", 
    "notification_agent"
  ]
}
```

### Paso 2: Main Agent Planifica

```
Main Agent analiza:
  - Necesita 3 skills
  - Cada una mejor manejada por agente diferente
  - Requiere 2 credentials (stripe_key, sendgrid_key)
  
Decisión: Delegar a sub-agents
```

### Paso 3: Delegación 1 - Analytics

```typescript
// Main agent delega a analytics_agent
await skillBank.delegate({
  targetAgent: "analytics_agent",
  skill: "stripe_payment_analysis",
  input: { month: "2024-01" }
});

// Analytics agent internamente:
1. Solicita stripe_api_key del vault
   - Vault verifica: analytics_agent in allowedAgents ✅
2. Usa http_request tool con credential
3. Consulta también payment_policies doc via RAG (context-aware)
4. Genera análisis combinando API data + policies
5. Retorna: { payments: [...], insights: [...] }
```

### Paso 4: Delegación 2 - Report

```typescript
// Main agent delega a report_agent
await skillBank.delegate({
  targetAgent: "report_agent",
  skill: "generate_pdf_report",
  input: { data: <from_analytics>, title: "Monthly Report" }
});

// Report agent internamente:
1. Usa code_executor (Python + ReportLab)
2. Usa file_write para guardar PDF
3. No necesita credentials externas
4. Retorna: { pdfPath: "/tmp/report.pdf" }
```

### Paso 5: Delegación 3 - Notification

```typescript
// Main agent delega a notification_agent
await skillBank.delegate({
  targetAgent: "notification_agent",
  skill: "send_email_with_attachment",
  input: { 
    to: ["team@company.com"],
    attachment: <from_report>
  }
});

// Notification agent internamente:
1. Solicita sendgrid_api_key del vault
   - Vault verifica: notification_agent in allowedAgents ✅
2. Usa http_request tool con credential
3. Envía email con PDF adjunto
4. Retorna: { sent: true, messageId: "..." }
```

### Paso 6: Completado

```
Main Agent:
  ✅ Tarea completada exitosamente
  
Audit Trail:
  - analytics_agent usó stripe_api_key @ 10:30:00
  - notification_agent usó sendgrid_api_key @ 10:31:00
  - Total execution time: 45 segundos
  - Skills ejecutadas: 3
  - Agents involucrados: 3
  - Credentials usadas: 2 (scoped correctamente)
```

---

## Integración de Todos los Componentes

### Matriz de Capacidades

| Componente | Rol | Conecta Con |
|------------|-----|-------------|
| **Tool** | Ejecuta acción atómica | Skills, Agents |
| **Skill (tool-based)** | Orquesta tools | Tools, Credentials, Agents |
| **Skill (instructional)** | Proporciona metodología | (self-contained) |
| **Skill (context-aware)** | Apunta a conocimiento | Documents (RAG) |
| **Skill (hybrid)** | Combina todo | Tools, Docs, Credentials, Agents |
| **Credential** | Provee acceso seguro | Skills, Agents, Vault |
| **Agent** | Ejecuta skills | Skills, Credentials, Agents |
| **Document** | Almacena conocimiento | Skills (context-aware), RAG |

### API Unificada

```typescript
// DISCOVER
POST /api/skillbank/discover
{
  query: string,
  includeAgents: boolean,    // Incluir agentes disponibles
  includeDocuments: boolean  // Incluir documentos relacionados
}

// EXECUTE
POST /api/skillbank/execute
{
  targetId: string,
  targetType: "tool" | "skill" | "agent",
  input: object,
  requestCredentials: boolean,  // Si necesita credentials
  allowDelegation: boolean      // Si puede delegar a agents
}

// CREDENTIALS
POST /api/skillbank/credentials
GET  /api/skillbank/credentials/:id

// AGENTS
POST /api/skillbank/agents
GET  /api/skillbank/agents/:id
POST /api/skillbank/delegate  // Delegar a agent

// DOCUMENTS (via RAG existente)
GET  /api/query/smart  // Ya existe!
```

---

## Seguridad en Capas

### Layer 1: Credential Scoping
```
Credential → allowedSkills + allowedAgents
            ↓
Solo entities autorizadas pueden acceder
```

### Layer 2: Agent Isolation
```
Agent A: Acceso a [credential_1, credential_2]
Agent B: Acceso a [credential_3]
            ↓
Agents no comparten credentials
```

### Layer 3: Audit Trail
```
Cada uso de credential se loguea:
- Quién (skill/agent)
- Cuándo (timestamp)
- Para qué (skill execution)
- Resultado (success/fail)
```

---

## Estado Actual vs Futuro

### Implementado ✅
- Tools atómicas
- Skills (tool-based, instructional, context-aware, hybrid)
- Discovery (RAG + Graph)
- Integration con RAG de documentos
- API REST completa

### Planeado 🚧

**Q2 2025: Credentials Vault**
- Local encrypted vault
- Credential scoping
- Audit trail
- Rotation policies

**Q3 2025: Sub-Agents**
- Agent registry
- Delegation API
- Multi-agent coordination
- Parallel execution

**Q4 2025: Memory & Learning ⭐**
- User identity management
- Conversational memory (por usuario)
- Execution history tracking
- Automatic preference learning
- Pattern detection and optimization
- Personalized execution (mismo skill, diferente por usuario)

---

## Conclusión

**Skill Bank es un ecosistema completo:**

```
Meta-Tool Unificada
  ├─ Tools (ejecutables)
  ├─ Skills (4 tipos de conocimiento)
  ├─ Credentials (seguridad)
  ├─ Agents (especialización)
  └─ Documents (base de conocimiento vía RAG)

= Sistema completo de Knowledge Augmentation
```

**Key Features:**
- ✅ No necesita MCP (reutiliza patrones existentes)
- ✅ Integra con RAG jerárquico
- ✅ Secure by design (credentials scoping)
- ✅ Horizontally scalable (sub-agents)
- ✅ Flexible (4 tipos de skills)
- ✅ Familiar patterns (n8n workflows)

**Documentación:**
- [SKILLBANK.md](../SKILLBANK.md) - Overview
- [SKILLBANK_SKILL_TYPES.md](SKILLBANK_SKILL_TYPES.md) - 4 tipos de skills
- [SKILLBANK_EXTENSIONS.md](SKILLBANK_EXTENSIONS.md) - Credentials + Agents
- [SKILLBANK_VS_N8N.md](SKILLBANK_VS_N8N.md) - Comparación con n8n/Make
- [SKILLBANK_DESIGN_PRINCIPLES.md](SKILLBANK_DESIGN_PRINCIPLES.md) - Atomicidad

