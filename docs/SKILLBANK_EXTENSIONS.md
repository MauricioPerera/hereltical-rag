# Skill Bank - Extensiones Avanzadas

## Por Qué No Necesitamos MCP (Model Context Protocol)

### MCP: Complexity Overhead

```
MCP Architecture:
┌──────────────┐
│    Agent     │
└──────┬───────┘
       │ Via MCP Protocol
       ▼
┌──────────────┐
│ MCP Server   │  ← Capa adicional de complejidad
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   Tools      │
└──────────────┘

Problemas:
- Protocolo custom a aprender
- Servidor MCP a mantener
- Serialización/deserialización overhead
- No reutiliza patrones existentes
```

### Skill Bank: Familiar Patterns

```
Skill Bank:
┌──────────────┐
│    Agent     │
└──────┬───────┘
       │ Simple REST API
       ▼
┌──────────────┐
│ Skill Bank   │  ← Reutiliza patrón workflow (n8n)
│ (Discovery)  │     + RAG jerárquico existente
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Tools/Skills │
└──────────────┘

Ventajas:
- Usa patrones familiares (workflows)
- API REST estándar
- Integra con RAG existente
- Semantic search built-in
```

**Key Insight:** Skill Bank aprovecha infraestructura existente (vector store, grafo) y patrones familiares (n8n workflows) en lugar de inventar nuevo protocolo.

---

## Extensión 1: Credentials Vault 🔐

### Problema

```yaml
# Actualmente (Inseguro)
skill: stripe_api_handler
instructions:
  - Obtener STRIPE_SECRET_KEY del entorno  ← Expuesto globalmente
  - Usar en HTTP request
```

**Riesgos:**
- Agente tiene acceso a TODAS las credenciales
- No hay principle of least privilege
- Difícil auditar qué skill usó qué credential
- Credentials hardcoded en environment

### Solución: Credential Entity

```typescript
interface Credential {
  id: string;
  name: string;
  type: 'credential';
  
  // Metadata
  service: string;           // stripe, github, sendgrid
  credentialType: string;    // api_key, oauth, jwt, basic_auth
  
  // Scope
  allowedSkills: string[];   // Solo estas skills pueden usar
  allowedTools: string[];    // O estas tools
  
  // Vault storage (encrypted)
  vaultPath: string;         // Referencia al vault local
  
  // Security
  expiresAt?: string;
  rotationPolicy?: string;
  
  // Audit
  createdAt: string;
  lastUsedAt?: string;
  usageCount: number;
}
```

### Arquitectura del Vault

```
┌─────────────────────────────────────────────────────────┐
│                   Skill Bank                            │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Skills ──┬──> Credentials ──> Local Vault             │
│           │                     (Encrypted)             │
│  Tools ───┘                                             │
│                                                         │
└─────────────────────────────────────────────────────────┘

Local Vault Options:
1. File-based: ~/.skillbank/credentials.vault (encrypted)
2. OS Keychain: macOS Keychain, Windows Credential Manager
3. HashiCorp Vault: Production-grade local instance
4. pass: Unix password manager (GPG-encrypted)
```

### Modelo de Grafo con Credentials

```
SKILL ──REQUIRES_CREDENTIAL──> CREDENTIAL ──GRANTS_ACCESS──> SERVICE

Ejemplo:
stripe_api_handler ──REQUIRES_CREDENTIAL──> stripe_api_key
                                             ↓
                                        [Vault: encrypted]
                                             ↓
                                        api.stripe.com
```

### Ejemplo de Uso

```yaml
# Credential Definition
id: stripe_api_key
name: Stripe API Key
type: credential
service: stripe
credentialType: api_key
allowedSkills: 
  - stripe_api_handler
  - stripe_payment_processor
  - stripe_refund_handler
vaultPath: vault://stripe/api_key
expiresAt: 2025-12-31

# Skill Reference
id: stripe_api_handler
usesTools: [http_request]
requiresCredentials: [stripe_api_key]  ← Nueva propiedad

instructions:
  steps:
    - Solicitar credential stripe_api_key via Skill Bank
    - Skill Bank verifica allowedSkills
    - Si autorizado, retorna credential decrypted
    - Usar en HTTP request
    - Credential se destruye después del uso (no se almacena)
```

### API para Credentials

```typescript
// Registrar credential
POST /api/skillbank/credentials
{
  "name": "Stripe API Key",
  "service": "stripe",
  "allowedSkills": ["stripe_api_handler"],
  "value": "sk_test_...",  // Será encrypted
  "vaultPath": "vault://stripe/api_key"
}

// Skill solicita credential durante ejecución
POST /api/skillbank/execute
{
  "targetId": "stripe_api_handler",
  "targetType": "skill",
  "input": {...},
  "requestCredentials": true  ← Flag
}

// Skill Bank internamente:
1. Verifica que skill está en allowedSkills
2. Desencripta credential del vault
3. Inyecta en ejecución de la skill
4. Loguea uso (audit trail)
5. Destruye credential después de uso
```

### Principio de Least Privilege

```
Skill A puede usar:  [stripe_api_key, sendgrid_api_key]
Skill B puede usar:  [github_token]
Skill C puede usar:  [db_password]

→ Cada skill solo accede a lo que necesita
→ Audit trail completo de quién usó qué
→ Credentials rotables sin cambiar skills
```

---

## Extensión 2: Sub-Agents 🤖

### Problema

```
Agente recibe tarea compleja:
"Analizar ventas del mes, generar reporte y enviarlo al equipo"

Opción actual:
- Agente ejecuta TODO secuencialmente
- Si algo falla, todo falla
- No hay paralelización
- No hay especialización
```

### Solución: Agent Entity

```typescript
interface Agent {
  id: string;
  name: string;
  type: 'agent';
  
  // Capabilities
  specialization: string[];   // analytics, reporting, communication
  availableSkills: string[];  // Skills que este agente conoce
  availableTools: string[];   // Tools que puede ejecutar
  
  // Communication
  protocol: 'http' | 'grpc' | 'message_queue';
  endpoint: string;           // URL o address del agente
  
  // Trust & Security
  trustLevel: number;         // 0-1, cuánto confiar en este agente
  requiresCredentials: string[]; // Credentials necesarias
  
  // Performance
  avgResponseTime: number;    // ms
  successRate: number;        // 0-1
  
  // Metadata
  createdAt: string;
  lastSeenAt: string;
}
```

### Modelo de Grafo con Agents

```
AGENT ──CAN_EXECUTE──> SKILL
AGENT ──DELEGATES_TO──> AGENT
AGENT ──REQUESTS_FROM──> AGENT
SKILL ──BEST_HANDLED_BY──> AGENT

Ejemplo:
main_agent ──DELEGATES_TO──> analytics_agent
                              ↓
                         CAN_EXECUTE
                              ↓
                     analyze_sales_data (skill)
```

### Tipos de Agentes

```typescript
// 1. Main Agent (Orchestrator)
{
  id: "main_agent",
  specialization: ["orchestration", "planning"],
  role: "coordinator"
}

// 2. Specialist Agent (Domain Expert)
{
  id: "analytics_agent",
  specialization: ["data_analysis", "sql", "statistics"],
  availableSkills: [
    "analyze_sales",
    "generate_insights",
    "create_charts"
  ]
}

// 3. Communication Agent
{
  id: "notification_agent",
  specialization: ["email", "slack", "notifications"],
  availableSkills: [
    "send_email",
    "post_to_slack",
    "send_sms"
  ]
}
```

### Flujo de Delegación

```
Usuario: "Analizar ventas y notificar al equipo"
           ↓
    ┌─────────────┐
    │ Main Agent  │
    └──────┬──────┘
           │ discover: "analyze sales data"
           ▼
    ┌─────────────┐
    │ Skill Bank  │
    └──────┬──────┘
           │ Returns: analyze_sales skill
           │ BEST_HANDLED_BY: analytics_agent
           ▼
    ┌─────────────┐
    │Main Agent   │ Decision: Delegate or Execute?
    └──────┬──────┘
           │ Delegate to analytics_agent
           ▼
    ┌──────────────────┐
    │ Analytics Agent  │
    └──────┬───────────┘
           │ Executes: analyze_sales
           │ Returns: { insights: [...], chartUrl: "..." }
           ▼
    ┌─────────────┐
    │ Main Agent  │
    └──────┬──────┘
           │ discover: "send report to team"
           ▼
    ┌─────────────┐
    │ Skill Bank  │
    └──────┬──────┘
           │ Returns: send_email skill
           │ BEST_HANDLED_BY: notification_agent
           ▼
    ┌──────────────────────┐
    │ Notification Agent   │
    └──────┬───────────────┘
           │ Executes: send_email with report
           │ Returns: { sent: true, messageId: "..." }
           ▼
    ┌─────────────┐
    │ Main Agent  │ ✅ Task completed
    └─────────────┘
```

### API para Sub-Agents

```typescript
// Registrar agente
POST /api/skillbank/agents
{
  "id": "analytics_agent",
  "name": "Analytics Specialist",
  "specialization": ["data_analysis"],
  "endpoint": "http://localhost:3001",
  "availableSkills": ["analyze_sales", "generate_insights"]
}

// Asociar skill con mejor agente
POST /api/skillbank/graph/link
{
  "fromId": "analyze_sales",
  "toId": "analytics_agent",
  "type": "BEST_HANDLED_BY",
  "weight": 0.95
}

// Main agent delega tarea
POST /api/skillbank/delegate
{
  "targetAgent": "analytics_agent",
  "skill": "analyze_sales",
  "input": { dateRange: "2024-01" },
  "timeout": 30000
}
```

### Patrones de Colaboración

#### 1. Delegation (Delegación)

```
Main Agent → Sub-Agent
  ↓
Task → Results
  ↓
Main Agent continues
```

#### 2. Request (Solicitud)

```
Agent A needs data → Request to Agent B
                   ← Agent B responds
Agent A continues with data
```

#### 3. Parallel Execution

```
Main Agent
  ├──> Analytics Agent (analyze)
  ├──> Report Agent (format)
  └──> Notification Agent (send)
       ↓
  Wait for all
       ↓
  Combine results
```

### Ejemplo Completo: Multi-Agent Task

```yaml
# Tarea compleja
task: "Analizar ventas del Q1, generar reporte PDF y enviarlo al equipo"

# Main Agent descubre skills
discovered:
  - analyze_sales_data (BEST_HANDLED_BY: analytics_agent)
  - generate_pdf_report (BEST_HANDLED_BY: report_agent)
  - send_email_with_attachment (BEST_HANDLED_BY: comm_agent)

# Main Agent delega
execution:
  - step: 1
    agent: analytics_agent
    skill: analyze_sales_data
    input: { quarter: "Q1", year: 2024 }
    result: { sales: [...], insights: [...] }
  
  - step: 2
    agent: report_agent
    skill: generate_pdf_report
    input: { data: <from_step_1>, template: "sales" }
    result: { pdfPath: "/tmp/q1_report.pdf" }
  
  - step: 3
    agent: comm_agent
    skill: send_email_with_attachment
    input: 
      to: ["team@company.com"]
      subject: "Q1 Sales Report"
      attachment: <from_step_2>
    result: { sent: true, messageId: "..." }

# Main Agent retorna
result: "✅ Q1 report analyzed, generated and sent successfully"
```

---

## Integración: Credentials + Sub-Agents

### Problema de Seguridad

```
¿Cómo maneja credentials un sub-agent?
  - ¿Main agent pasa credentials? ❌ Inseguro
  - ¿Sub-agent tiene sus propias credentials? ✅ Mejor
```

### Solución: Credential Scoping

```yaml
# Credential con scope de agentes
credential:
  id: stripe_api_key
  allowedSkills: [stripe_api_handler]
  allowedAgents: [payment_agent, main_agent]  ← Nueva propiedad
  
# Payment Agent ejecuta skill
payment_agent:
  availableSkills: [stripe_api_handler]
  credentials: [stripe_api_key]  ← Tiene acceso directo
  
# Main Agent delega
main_agent:
  delegates_to: payment_agent
  # NO necesita stripe_api_key porque payment_agent lo tiene
```

### Flujo Seguro

```
Main Agent: "Procesar pago de $100"
     ↓
Skill Bank: "stripe_payment skill BEST_HANDLED_BY payment_agent"
     ↓
Main Agent → Delega a payment_agent
     ↓
payment_agent:
  - Solicita stripe_api_key del vault
  - Vault verifica: payment_agent in allowedAgents ✅
  - Ejecuta skill con credential
  - Retorna resultado a main_agent
  - Credential destruida
```

---

## Modelo de Datos Extendido

```typescript
// Unified Store Schema
entities:
  - tools
  - skills
  - credentials  ← NEW
  - agents       ← NEW

edges:
  // Existentes
  - ENABLES (tool → skill)
  - USES (skill → tool)
  - REQUIRES (skill → skill)
  - PRODUCES_INPUT_FOR (skill → skill)
  
  // Credentials
  - REQUIRES_CREDENTIAL (skill → credential)
  - GRANTS_ACCESS (credential → service)
  - ALLOWED_FOR (credential → skill/agent)
  
  // Agents
  - CAN_EXECUTE (agent → skill)
  - DELEGATES_TO (agent → agent)
  - REQUESTS_FROM (agent → agent)
  - BEST_HANDLED_BY (skill → agent)
  - HAS_ACCESS_TO (agent → credential)
```

---

## Roadmap de Implementación

### Phase 1: Credentials (2-3 semanas)

1. **Week 1:**
   - [ ] Diseñar Credential entity y schema
   - [ ] Implementar local vault (file-based encrypted)
   - [ ] Añadir requiresCredentials a Skills
   - [ ] API endpoints para credentials CRUD

2. **Week 2:**
   - [ ] Integrar vault con execute API
   - [ ] Implementar verificación de allowedSkills
   - [ ] Audit logging de credential usage
   - [ ] CLI para gestionar credentials

3. **Week 3:**
   - [ ] Integración con OS keychain (macOS, Windows)
   - [ ] Rotation policy implementation
   - [ ] Documentation y ejemplos
   - [ ] Testing de seguridad

### Phase 2: Sub-Agents (3-4 semanas)

1. **Week 1:**
   - [ ] Diseñar Agent entity y schema
   - [ ] Implementar agent registration API
   - [ ] Añadir BEST_HANDLED_BY edges al grafo

2. **Week 2:**
   - [ ] Implementar delegation API
   - [ ] Request/response protocol entre agentes
   - [ ] Timeout y error handling

3. **Week 3:**
   - [ ] Parallel execution support
   - [ ] Agent discovery y routing
   - [ ] Load balancing entre agentes

4. **Week 4:**
   - [ ] Credential scoping para agentes
   - [ ] Trust level y authorization
   - [ ] Monitoring y observability
   - [ ] Documentation completa

---

## Conclusión

Estas dos extensiones transforman Skill Bank en un sistema completo:

```
Skill Bank v1 (Actual):
  Tools + Skills + Discovery

Skill Bank v2 (Extended):
  Tools + Skills + Credentials + Agents + Discovery

Capabilities:
  ✅ Semantic discovery
  ✅ Atomic tools + specific skills
  ✅ Secure credential management
  ✅ Multi-agent collaboration
  ✅ Principle of least privilege
  ✅ Audit trail completo
  ✅ Horizontal scaling via agents
```

**Key Insight:** Cada extensión mantiene el principio core de atomicidad y diversidad vectorial, mientras añade capabilities enterprise-grade.

