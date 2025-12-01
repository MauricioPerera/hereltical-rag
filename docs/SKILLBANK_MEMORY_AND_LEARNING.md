# Skill Bank - Memory & Learning System

## El Problema

```
Usuario A: "Genera reporte de ventas"
Agente: Ejecuta desde cero, hace preguntas, decide formato...

Usuario A (2 días después): "Genera reporte de ventas"
Agente: ❌ Vuelve a preguntar todo, como si fuera primera vez

Usuario B: "Genera reporte de ventas"
Agente: ❌ Usa el mismo formato que para Usuario A
         (pero Usuario B prefiere formato diferente)
```

**Ineficiente y frustrante para usuarios frecuentes.**

---

## La Solución: Memory & Learning Layer

```
┌───────────────────────────────────────────────────────────┐
│                    SKILL BANK                             │
├───────────────────────────────────────────────────────────┤
│                                                           │
│  ┌────────┐ ┌────────┐ ┌────────────┐ ┌────────┐       │
│  │ Tools  │ │ Skills │ │Credentials │ │ Agents │       │
│  └────────┘ └────────┘ └────────────┘ └────────┘       │
│                          │                               │
│  ┌──────────────────────┴────────────────────┐          │
│  │         MEMORY & LEARNING LAYER            │  ← NEW! │
│  ├────────────────────────────────────────────┤          │
│  │ • Conversational Memory (por usuario)      │          │
│  │ • Execution History (cómo se ejecutó)      │          │
│  │ • User Preferences (personalizaciones)     │          │
│  │ • Pattern Learning (mejora continua)       │          │
│  └────────────────────────────────────────────┘          │
└───────────────────────────────────────────────────────────┘
```

---

## Componente 1: User Identity

### Problema
Sin ID único de usuario, no hay forma de relacionar:
- Conversaciones del mismo usuario
- Historial de ejecuciones
- Preferencias personalizadas

### Solución: User Entity

```typescript
interface User {
  id: string;                    // UUID único
  type: 'user';
  
  // Identity
  identifiers: {
    email?: string;
    externalId?: string;         // ID de sistema externo
    sessionIds: string[];        // Sesiones asociadas
  };
  
  // Profile
  name?: string;
  timezone?: string;
  language?: string;
  
  // Metadata
  createdAt: string;
  lastSeenAt: string;
  totalSessions: number;
  totalExecutions: number;
}
```

### Ejemplo

```yaml
user:
  id: user_abc123
  identifiers:
    email: john@company.com
    sessionIds: [sess_1, sess_2, sess_3]
  name: John Doe
  timezone: America/New_York
  createdAt: 2024-01-01
  totalExecutions: 47
```

---

## Componente 2: Conversational Memory

### Por Usuario
Cada usuario tiene su propio contexto conversacional.

```typescript
interface ConversationHistory {
  userId: string;
  sessionId: string;
  
  messages: Message[];
  
  // Context window
  activeContext: {
    recentTasks: string[];       // Últimas tareas mencionadas
    entityMentions: string[];    // Entidades discutidas
    pendingActions: string[];    // Acciones pendientes
  };
  
  // Metadata
  startedAt: string;
  lastMessageAt: string;
  messageCount: number;
}

interface Message {
  id: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  timestamp: string;
  metadata?: {
    skillsUsed?: string[];
    toolsExecuted?: string[];
    agentsInvolved?: string[];
  };
}
```

### Ejemplo de Uso

```typescript
// Usuario A, Sesión 1
user: "Genera reporte de ventas"
agent: "¿Qué formato prefieres? PDF o Excel?"
user: "PDF"
agent: [ejecuta, genera PDF] ✓

// Usuario A, Sesión 2 (2 días después)
user: "Genera reporte de ventas"
agent: [revisa conversational memory]
       "Genero PDF como la última vez. ¿Mismo formato?"
user: "Sí"
agent: [ejecuta directamente, sin preguntas] ✓
```

---

## Componente 3: Execution History

### Qué se Registra
Cada ejecución de skill se registra con detalles completos.

```typescript
interface ExecutionRecord {
  id: string;
  userId: string;
  sessionId: string;
  
  // What was executed
  skill: {
    id: string;
    name: string;
    type: 'tool_based' | 'instructional' | 'context_aware' | 'hybrid';
  };
  
  // How it was executed
  execution: {
    input: Record<string, any>;
    output: any;
    toolsUsed: string[];
    credentialsUsed: string[];
    agentsInvolved: string[];
    documentsReferenced: string[];
  };
  
  // Context
  context: {
    userIntent: string;          // Query original del usuario
    inferredParameters: Record<string, any>;  // Parámetros que se infirieron
    explicitParameters: Record<string, any>;  // Parámetros dados explícitamente
  };
  
  // Outcome
  success: boolean;
  userFeedback?: 'positive' | 'negative' | 'neutral';
  
  // Metadata
  timestamp: string;
  executionTime: number;
}
```

### Ejemplo

```json
{
  "id": "exec_xyz789",
  "userId": "user_abc123",
  "skill": {
    "id": "generate_sales_report",
    "name": "Generate Sales Report"
  },
  "execution": {
    "input": {
      "period": "monthly",
      "format": "pdf",
      "includeCharts": true
    },
    "toolsUsed": ["data_fetcher", "pdf_generator"],
    "output": { "reportPath": "/reports/sales_jan.pdf" }
  },
  "context": {
    "userIntent": "genera reporte de ventas",
    "inferredParameters": {
      "period": "monthly",        // ← Inferido de historial
      "format": "pdf",            // ← Inferido de preferencia
      "includeCharts": true       // ← Inferido de ejecuciones previas
    },
    "explicitParameters": {}      // Usuario no especificó nada
  },
  "success": true,
  "userFeedback": "positive",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

---

## Componente 4: User Preferences

### Preferencias Aprendidas
El sistema aprende preferencias de usuario basándose en historial.

```typescript
interface UserPreferences {
  userId: string;
  
  // Preferencias por skill
  skillPreferences: Record<string, SkillPreference>;
  
  // Preferencias generales
  general: {
    communicationStyle: 'verbose' | 'concise' | 'technical';
    timezone: string;
    language: string;
    notificationPreference: 'email' | 'slack' | 'none';
  };
  
  // Metadata
  confidence: number;            // 0-1, confianza en preferencias
  lastUpdated: string;
}

interface SkillPreference {
  skillId: string;
  
  // Parámetros preferidos
  defaultParameters: Record<string, any>;
  
  // Patrones observados
  patterns: {
    parameter: string;
    value: any;
    frequency: number;           // Veces que se usó este valor
    lastUsed: string;
  }[];
  
  // Contexto
  usualContext: {
    timeOfDay?: string;          // "morning", "afternoon"
    dayOfWeek?: string;          // "monday", "friday"
    frequency?: string;          // "daily", "weekly"
  };
}
```

### Ejemplo: Preferencias Aprendidas

```json
{
  "userId": "user_abc123",
  "skillPreferences": {
    "generate_sales_report": {
      "defaultParameters": {
        "format": "pdf",           // Usado 8 de 10 veces
        "includeCharts": true,     // Usado 9 de 10 veces
        "emailRecipients": ["manager@company.com"]  // Siempre igual
      },
      "patterns": [
        {
          "parameter": "period",
          "value": "monthly",
          "frequency": 8,
          "lastUsed": "2024-01-15"
        },
        {
          "parameter": "format",
          "value": "pdf",
          "frequency": 8
        }
      ],
      "usualContext": {
        "timeOfDay": "morning",    // Usuario siempre pide en la mañana
        "dayOfWeek": "monday",     // Mayormente los lunes
        "frequency": "weekly"      // Una vez por semana
      }
    }
  },
  "general": {
    "communicationStyle": "concise",  // Usuario prefiere respuestas breves
    "timezone": "America/New_York",
    "language": "es"
  },
  "confidence": 0.85
}
```

---

## Componente 5: Pattern Learning

### Aprendizaje de Patrones
El sistema detecta patrones en las ejecuciones.

```typescript
interface LearnedPattern {
  id: string;
  userId: string;
  
  // Pattern identification
  pattern: {
    trigger: string;             // Query pattern
    skill: string;               // Skill ejecutada
    context: Record<string, any>; // Condiciones
  };
  
  // Execution blueprint
  blueprint: {
    parameters: Record<string, any>;
    toolSequence: string[];
    expectedDuration: number;
  };
  
  // Learning metrics
  occurrences: number;           // Veces que se observó
  successRate: number;           // % de éxito
  confidence: number;            // Confianza del patrón
  
  // Metadata
  firstSeen: string;
  lastSeen: string;
}
```

### Ejemplo: Patrón Detectado

```json
{
  "id": "pattern_123",
  "userId": "user_abc123",
  "pattern": {
    "trigger": "genera reporte de ventas",
    "skill": "generate_sales_report",
    "context": {
      "dayOfWeek": "monday",
      "timeOfDay": "morning"
    }
  },
  "blueprint": {
    "parameters": {
      "period": "monthly",
      "format": "pdf",
      "includeCharts": true
    },
    "toolSequence": ["data_fetcher", "pdf_generator", "email_sender"],
    "expectedDuration": 45000
  },
  "occurrences": 12,
  "successRate": 0.92,
  "confidence": 0.88,
  "firstSeen": "2024-01-01",
  "lastSeen": "2024-01-15"
}
```

---

## Flujo Completo con Memoria

### Primera Ejecución (Cold Start)

```
Usuario A, Sesión 1:
  User: "Genera reporte de ventas"
  
  Agent:
    1. Busca en execution history → Vacío (primera vez)
    2. Busca en user preferences → Vacío
    3. Hace preguntas para recopilar parámetros:
       "¿Qué formato prefieres? PDF o Excel?"
       "¿Incluyo gráficos?"
       "¿A quién envío el reporte?"
    
    4. Ejecuta con parámetros recopilados
    5. REGISTRA ejecución en history
    6. ACTUALIZA user preferences
  
  Result: ✓ Reporte generado (con varias preguntas)
```

### Segunda Ejecución (Warm Start)

```
Usuario A, Sesión 5 (2 semanas después):
  User: "Genera reporte de ventas"
  
  Agent:
    1. Busca en execution history → 4 ejecuciones previas
    2. Busca en user preferences → Detecta patrón:
       - format: "pdf" (usado 4 de 4 veces)
       - includeCharts: true (usado 4 de 4 veces)
       - emailTo: ["manager@company.com"] (siempre igual)
    
    3. Aplica preferencias aprendidas:
       "Genero reporte PDF con gráficos como siempre. ¿OK?"
    
    4. Usuario: "Sí"
    5. Ejecuta directamente (sin preguntas adicionales)
    6. ACTUALIZA execution count y confidence
  
  Result: ✓ Reporte generado (sin preguntas, más rápido)
```

### Ejecución con Variación

```
Usuario A:
  User: "Genera reporte de ventas, pero en Excel esta vez"
  
  Agent:
    1. Detecta patrón conocido
    2. Detecta OVERRIDE explícito: format="excel"
    3. Aplica preferencias excepto override:
       - format: "excel" (override)
       - includeCharts: true (preferencia)
       - emailTo: ["manager@company.com"] (preferencia)
    
    4. Ejecuta con mix de preferencias + override
    5. REGISTRA como variación (no actualiza default)
  
  Result: ✓ Reporte Excel con resto de preferencias
```

---

## Diferenciación por Usuario

### Usuario A vs Usuario B

```yaml
# Usuario A (Manager)
preferences:
  generate_sales_report:
    format: pdf
    includeCharts: true
    detailLevel: summary
    emailTo: [executives@company.com]
    
pattern:
  frequency: weekly
  dayOfWeek: monday
  timeOfDay: morning

# Usuario B (Analyst)  
preferences:
  generate_sales_report:
    format: excel           # ← Diferente!
    includeCharts: true
    detailLevel: detailed   # ← Más detalle!
    emailTo: [team@company.com]  # ← Diferentes destinatarios!
    
pattern:
  frequency: daily
  dayOfWeek: any
  timeOfDay: afternoon
```

**Mismo skill, diferente ejecución por usuario** ✓

---

## Aprendizaje Continuo

### Proceso de Mejora

```
1. OBSERVACIÓN
   ↓
   Usuario ejecuta skill → Se registra
   
2. DETECCIÓN DE PATRONES
   ↓
   Sistema analiza execution history
   Identifica parámetros recurrentes
   Calcula confidence scores
   
3. FORMACIÓN DE PREFERENCIAS
   ↓
   Si parameter usado >70% de veces
   → Se convierte en default preference
   
4. APLICACIÓN PROACTIVA
   ↓
   Próxima ejecución aplica preferencias
   Sin preguntar (pero permitiendo override)
   
5. REFINAMIENTO
   ↓
   Si usuario hace override
   → Se ajusta confidence
   Si override recurrente
   → Se actualiza preferencia
```

### Métricas de Aprendizaje

```typescript
interface LearningMetrics {
  userId: string;
  
  // Eficiencia
  averageQuestionsPerExecution: {
    initial: number;             // Promedio al inicio
    current: number;             // Promedio actual
    improvement: number;         // % de reducción
  };
  
  // Precisión
  parameterAccuracy: {
    correct: number;             // Parámetros inferidos correctos
    total: number;
    accuracy: number;            // % correcto
  };
  
  // Velocidad
  executionSpeed: {
    initial: number;             // ms promedio inicial
    current: number;             // ms promedio actual
    improvement: number;         // % de mejora
  };
  
  // Satisfacción
  userSatisfaction: {
    positiveFeedback: number;
    negativeFeedback: number;
    score: number;               // 0-1
  };
}
```

---

## Modelo de Datos

### Nuevas Tablas

```sql
-- Users
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT,
  external_id TEXT,
  name TEXT,
  timezone TEXT,
  language TEXT,
  created_at TEXT,
  last_seen_at TEXT,
  total_executions INTEGER DEFAULT 0
);

-- Conversation History
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,  -- 'user' | 'agent' | 'system'
  content TEXT NOT NULL,
  metadata TEXT,       -- JSON
  timestamp TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_conversations_user ON conversations(user_id);
CREATE INDEX idx_conversations_session ON conversations(session_id);

-- Execution History
CREATE TABLE execution_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  session_id TEXT,
  skill_id TEXT NOT NULL,
  skill_type TEXT NOT NULL,
  input TEXT NOT NULL,       -- JSON
  output TEXT,               -- JSON
  context TEXT,              -- JSON (inferred params, etc)
  tools_used TEXT,           -- JSON array
  agents_involved TEXT,      -- JSON array
  success BOOLEAN NOT NULL,
  user_feedback TEXT,        -- 'positive' | 'negative' | 'neutral'
  execution_time INTEGER,
  timestamp TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_exec_history_user ON execution_history(user_id);
CREATE INDEX idx_exec_history_skill ON execution_history(skill_id);
CREATE INDEX idx_exec_history_timestamp ON execution_history(timestamp);

-- User Preferences
CREATE TABLE user_preferences (
  user_id TEXT NOT NULL,
  skill_id TEXT NOT NULL,
  parameter_key TEXT NOT NULL,
  parameter_value TEXT NOT NULL,  -- JSON
  frequency INTEGER DEFAULT 1,
  confidence REAL DEFAULT 0.5,
  last_used TEXT,
  PRIMARY KEY (user_id, skill_id, parameter_key),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Learned Patterns
CREATE TABLE learned_patterns (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  trigger_pattern TEXT NOT NULL,
  skill_id TEXT NOT NULL,
  context TEXT,              -- JSON
  blueprint TEXT NOT NULL,   -- JSON (params, tools, etc)
  occurrences INTEGER DEFAULT 1,
  success_rate REAL,
  confidence REAL,
  first_seen TEXT,
  last_seen TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

---

## API Extensions

```typescript
// MEMORY API

// Get user context
GET /api/skillbank/memory/user/:userId
Response: {
  user: User,
  recentExecutions: ExecutionRecord[],
  preferences: UserPreferences,
  learnedPatterns: LearnedPattern[]
}

// Get conversation history
GET /api/skillbank/memory/conversations/:userId/:sessionId
Response: {
  messages: Message[],
  activeContext: {...}
}

// Record execution (automatic)
POST /api/skillbank/memory/executions
Body: ExecutionRecord

// Update user feedback
POST /api/skillbank/memory/feedback
Body: {
  executionId: string,
  feedback: 'positive' | 'negative' | 'neutral'
}

// SMART EXECUTION (with memory)

POST /api/skillbank/execute/smart
Body: {
  userId: string,           // ← Required!
  sessionId: string,
  query: string,            // Natural language
  allowInference: boolean   // Apply learned preferences
}

Response: {
  skill: string,
  inferredParameters: {...},
  needsConfirmation: string[],  // Params that need user OK
  execution: ExecutionResult
}
```

---

## Ejemplo Completo: Evolución con Uso

### Mes 1 (Cold Start)

```
Usuario A ejecuta "generate_sales_report" por primera vez:
  
  Preguntas necesarias: 5
  Tiempo de setup: 2 minutos
  Parámetros manuales: 100%
  
  → Sistema registra ejecución
```

### Mes 2 (Learning)

```
Usuario A ha ejecutado 8 veces:
  
  Preguntas necesarias: 2 (↓60%)
  Tiempo de setup: 45 segundos (↓62%)
  Parámetros inferidos: 60%
  
  → Sistema detectó patrón
  → Creó preferencias
```

### Mes 3 (Optimized)

```
Usuario A ejecuta habitualmente:
  
  Preguntas necesarias: 0 (↓100%)
  Tiempo de setup: 10 segundos (↓92%)
  Parámetros inferidos: 95%
  
  User: "Genera reporte de ventas"
  Agent: "OK, PDF con gráficos como siempre. Enviando..." ✓
  
  → Experiencia optimizada
  → Usuario satisfecho
```

---

## Beneficios del Sistema de Memoria

### Para el Usuario

- ✅ **Menos preguntas repetitivas** - El agente "recuerda"
- ✅ **Ejecución más rápida** - No setup cada vez
- ✅ **Personalización automática** - Se adapta a cada usuario
- ✅ **Consistencia** - Mismos parámetros cada vez (si el usuario quiere)

### Para el Sistema

- ✅ **Eficiencia mejorada** - Menos interacciones
- ✅ **Mejor UX** - Usuarios satisfechos
- ✅ **Insights** - Entiende patrones de uso
- ✅ **Optimización continua** - Aprende con el tiempo

### Métricas de Éxito

```
KPIs a medir:
  - Reducción de preguntas por ejecución
  - Tiempo de setup (inicial vs actual)
  - Accuracy de parámetros inferidos
  - User satisfaction score
  - Execution success rate
```

---

## Conclusión

**Memory & Learning completa el ecosistema:**

```
Skill Bank Stack Completo:

Layer 1: Tools (capacidades atómicas)
Layer 2: Skills (conocimiento estructurado)
Layer 3: Credentials (seguridad)
Layer 4: Agents (especialización)
Layer 5: Documents (base de conocimiento)
Layer 6: Memory & Learning (personalización + mejora continua) ← NEW!

= Sistema completo que aprende y se adapta
```

**Key Features:**
- ✅ User identity (relacionar todo por usuario)
- ✅ Conversational memory (contexto persistente)
- ✅ Execution history (qué se hizo y cómo)
- ✅ User preferences (aprendizaje automático)
- ✅ Pattern detection (optimización continua)
- ✅ Personalización por usuario (mismo skill, diferente ejecución)

**El agente mejora con cada uso** 📈

