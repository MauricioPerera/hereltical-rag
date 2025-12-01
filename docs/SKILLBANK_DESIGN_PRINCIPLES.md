# Skill Bank - Principios de Diseño

## Principio #1: Tools Atómicas, Skills Específicas ⭐

### Concepto Core

> **Las Tools deben ser lo más atómicas/genéricas posibles. Las Skills contienen el conocimiento específico de CÓMO usar esas tools.**

### Ejemplo: CRUD Database

#### ❌ Anti-Pattern: Tools Específicas

```yaml
# Approach INCORRECTO - Tools muy específicas
tools:
  - id: create_db_record
  - id: read_db_record
  - id: update_db_record
  - id: delete_db_record

skills:
  - id: create_user
    usesTools: [create_db_record]
  - id: get_user
    usesTools: [read_db_record]
```

**Problemas:**
- 4 tools con funcionalidad muy similar
- Embeddings vectoriales demasiado parecidos (baja diversidad)
- Difícil mantener: cambios en la DB requieren actualizar 4 tools
- El agente puede confundirse entre tools similares

#### ✅ Pattern Correcto: Tool Atómica + Skills Específicas

```yaml
# Approach CORRECTO - Tool genérica
tools:
  - id: db_query
    description: Ejecuta queries SQL en la base de datos
    inputSchema:
      properties:
        query: { type: string }
        params: { type: array }

# Skills específicas con contexto rico
skills:
  - id: create_user
    usesTools: [db_query]
    overview: |
      Crea un nuevo usuario en la tabla users.
      Valida email, hashea password, asigna role por defecto.
    instructions:
      steps:
        - Validar que email sea único
        - Hashear password con bcrypt (10 rounds)
        - Preparar INSERT INTO users (email, password_hash, role, created_at)
        - Ejecutar db_query con prepared statement
        - Retornar user_id generado
      bestPractices:
        - Siempre usar prepared statements para prevenir SQL injection
        - Validar formato de email antes de insertar
        - No loguear passwords en ningún formato
    
  - id: delete_user
    usesTools: [db_query]
    overview: |
      Elimina un usuario de la tabla users.
      Soft delete (marca como deleted) en lugar de DELETE físico.
    instructions:
      steps:
        - Verificar que user_id existe
        - Ejecutar UPDATE users SET deleted_at = NOW() WHERE id = ?
        - No usar DELETE FROM users (preservar historial)
        - Loguear acción de eliminación para auditoría
    
  - id: get_user_by_email
    usesTools: [db_query]
    overview: |
      Busca un usuario por su email en la tabla users.
      Excluye usuarios eliminados (soft delete).
    instructions:
      steps:
        - Preparar SELECT * FROM users WHERE email = ? AND deleted_at IS NULL
        - Ejecutar db_query
        - Retornar NULL si no existe
        - Omitir password_hash del resultado
```

**Ventajas:**
- ✅ **1 tool genérica** → Fácil de mantener y extender
- ✅ **N skills específicas** → Alta diversidad vectorial
- ✅ **Contexto rico** → Cada skill tiene instrucciones únicas, ejemplos, validaciones
- ✅ **Mejor discovery** → El agente encuentra la skill exacta que necesita
- ✅ **Flexibilidad** → Misma tool sirve para cualquier query SQL

## Principio #2: Diversidad Vectorial = Mejor Retrieval

### Conexión con RAG Jerárquico

El Skill Bank se beneficia del mismo principio que el RAG jerárquico: **priorizar diversidad semántica**.

#### Embeddings de Tools Específicas (Baja Diversidad)

```
create_db_record    → [0.8, 0.2, 0.1, 0.5, ...]
read_db_record      → [0.8, 0.2, 0.1, 0.4, ...]  ← Muy similar
update_db_record    → [0.8, 0.2, 0.1, 0.5, ...]  ← Muy similar
delete_db_record    → [0.8, 0.2, 0.1, 0.5, ...]  ← Muy similar
```

**Problema:** El agente tiene dificultad para distinguir entre estas tools tan similares.

#### Embeddings de Tool Atómica + Skills (Alta Diversidad)

```
db_query                    → [0.8, 0.2, 0.1, 0.5, ...]

create_user                 → [0.3, 0.7, 0.8, 0.2, ...]  ← Muy diferente
delete_user                 → [0.1, 0.3, 0.2, 0.9, ...]  ← Muy diferente
get_user_by_email          → [0.6, 0.1, 0.5, 0.3, ...]  ← Muy diferente
update_user_password       → [0.2, 0.8, 0.3, 0.6, ...]  ← Muy diferente
```

**Ventaja:** Skills tienen embeddings muy distintos porque:
- Lenguaje natural variado ("crear", "eliminar", "buscar", "actualizar")
- Contexto específico (email, password, validaciones, auditoría)
- Best practices únicos por operación
- Ejemplos de uso diferentes

### Métricas de Diversidad

```python
# Pseudo-código para medir diversidad

# Approach 1: Tools específicas
tools_specific = [create_db, read_db, update_db, delete_db]
avg_similarity = 0.92  # MUY SIMILAR ❌

# Approach 2: Tool atómica + Skills
skills_specific = [create_user, delete_user, get_user, update_user]
avg_similarity = 0.43  # DIVERSO ✅

# Resultado: 53% mejora en diversidad → mejor retrieval
```

## Principio #3: La Tool es "Qué", la Skill es "Cómo"

| Aspecto | Tool | Skill |
|---------|------|-------|
| **Pregunta** | ¿QUÉ puedo hacer? | ¿CÓMO lo hago? |
| **Nivel** | Primitiva ejecutable | Receta de uso |
| **Atomicidad** | Máxima (genérica) | Específica (dominio) |
| **Cambios** | Raramente cambia | Evoluciona con el negocio |
| **Ejemplos** | `http_request`, `db_query`, `file_write` | `stripe_payment`, `create_user`, `generate_report` |

### Ejemplo: API Integration

```yaml
# 1 Tool Atómica
tools:
  - id: http_request
    description: Ejecuta HTTP requests a cualquier endpoint

# 5 Skills Específicas (usando la misma tool)
skills:
  - id: stripe_create_payment
    usesTools: [http_request]
    overview: Crea un pago en Stripe
    instructions:
      steps:
        - Obtener STRIPE_SECRET_KEY
        - POST a https://api.stripe.com/v1/charges
        - Header: Authorization Bearer {key}
        - Body: amount, currency, source
  
  - id: github_create_issue
    usesTools: [http_request]
    overview: Crea issue en GitHub
    instructions:
      steps:
        - Obtener GITHUB_TOKEN
        - POST a https://api.github.com/repos/{owner}/{repo}/issues
        - Header: Authorization token {token}
        - Body: title, body, labels
  
  - id: sendgrid_send_email
    usesTools: [http_request]
    overview: Envía email via SendGrid
    instructions:
      steps:
        - Obtener SENDGRID_API_KEY
        - POST a https://api.sendgrid.com/v3/mail/send
        - Header: Authorization Bearer {key}
        - Body: from, to, subject, content
```

**Diversidad:** Cada skill tiene:
- Contexto de API diferente (Stripe vs GitHub vs SendGrid)
- Autenticación específica (Bearer, token, API key)
- Vocabulario del dominio (payment, issue, email)
- Best practices únicos

## Principio #4: Granularidad de Skills

### Regla de Oro

> **Una skill = Una tarea atómica del negocio**

### Ejemplos de Granularidad Correcta

✅ **Bien granulado:**
```
Skills:
- create_user              (registrar nuevo usuario)
- verify_user_email        (confirmar email)
- reset_user_password      (recuperar contraseña)
- update_user_profile      (editar datos)
- deactivate_user          (desactivar cuenta)
```

❌ **Muy granular (anti-pattern):**
```
Skills:
- insert_user_to_db
- send_welcome_email
- log_user_creation
```
→ Esto son pasos de `create_user`, no skills independientes

❌ **Poco granular (anti-pattern):**
```
Skills:
- manage_users    (demasiado genérico)
```
→ Imposible de documentar específicamente

## Principio #5: Skills como Documentación Ejecutable

Las skills sirven dual propósito:
1. **Descubrimiento** → El agente encuentra qué hacer
2. **Documentación** → El agente aprende cómo hacerlo

### Estructura Rica de una Skill

```yaml
id: create_payment
usesTools: [http_request]

overview: |
  Crea un pago en Stripe para un monto específico.
  Soporta múltiples monedas y métodos de pago.

instructions:
  steps: [...]           # Cómo ejecutar
  prerequisites: [...]   # Qué necesito antes
  bestPractices: [...]   # Recomendaciones
  antiPatterns: [...]    # Qué NO hacer

parameters: [...]        # Inputs esperados
outputs: [...]           # Qué retorna

examples:                # Casos de uso concretos
  - situation: Cobrar suscripción mensual
    input: { amount: 999, currency: usd }
    expectedOutput: { charge_id: ch_xxx, status: succeeded }

errorHandling:           # Errores comunes y recovery
  commonErrors: [...]
  recovery: [...]
```

**Beneficio:** Esta riqueza de contexto mejora dramáticamente el embedding y el retrieval.

## Métricas de Éxito

### Antes: Tools Específicas
```
Query: "crear un nuevo usuario en la base de datos"

Resultados:
1. create_db_record     (0.85) ← Genérico
2. insert_into_table    (0.83) ← Genérico
3. add_database_entry   (0.81) ← Genérico

❌ Ninguno menciona usuarios, validaciones, o dominio específico
```

### Después: Tool Atómica + Skills
```
Query: "crear un nuevo usuario en la base de datos"

Resultados:
1. create_user          (0.94) ← Específico, rico en contexto
2. register_new_account (0.89) ← Contexto de usuarios
3. add_team_member      (0.76) ← Relacionado

✅ Resultados mucho más relevantes y específicos
```

## Implementación Práctica

### Checklist para Crear Tools

- [ ] ¿Es lo más atómica posible?
- [ ] ¿Podría servir para múltiples casos de uso?
- [ ] ¿Tiene responsabilidad única y clara?
- [ ] ¿Su input/output es genérico?

### Checklist para Crear Skills

- [ ] ¿Usa tools atómicas (no específicas)?
- [ ] ¿Tiene contexto rico y específico del dominio?
- [ ] ¿Las instrucciones son paso a paso?
- [ ] ¿Incluye best practices y anti-patterns?
- [ ] ¿Tiene ejemplos concretos de uso?
- [ ] ¿Su embedding será distinto de otras skills?

## Conclusión

**Tools Atómicas + Skills Específicas = RAG Efectivo**

Este diseño maximiza:
- ✅ Diversidad vectorial (mejor retrieval)
- ✅ Mantenibilidad (menos código duplicado)
- ✅ Flexibilidad (fácil extender)
- ✅ Claridad (separación de responsabilidades)

Y se alinea perfectamente con el RAG jerárquico que prioriza diversidad semántica para mejor recuperación de contexto.

