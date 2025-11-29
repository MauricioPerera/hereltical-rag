# Graph Evolution: De Jerarquía a Grafo

## Visión General

**hereltical-rag** ya es casi un grafo. Un árbol es un caso especial de grafo, y la evolución natural es hacer explícitas las relaciones que hoy son implícitas, además de agregar nuevos tipos de conexiones entre documentos.

## Estado Actual: Árbol por Documento

### Nodos
- `Document`: Raíz del árbol
- `Section`: Nodos internos (H1, H2, H3)
- Hojas: Secciones sin hijos

### Relaciones Implícitas
- `parentId`: Relación padre
- `childrenIds`: Relación hijos
- Hermanos: Hijos del mismo padre

### Limitaciones
- Contexto limitado a un solo árbol (documento)
- No hay relaciones cross-document
- No hay relaciones semánticas explícitas

---

## Evolución: Grafo de Conocimiento

### Fase 1: Grafo Básico (Actual Roadmap)

#### Tipos de Nodos
```typescript
type NodeType = 'document' | 'section';

interface GraphNode {
  node_id: string;
  type: NodeType;
  doc_id: string;
  title: string;
  level?: number;        // Solo para sections
  content?: string[];    // Solo para sections
  embedding_id?: string; // Referencia a vector store
}
```

#### Tipos de Aristas (Edges)
```typescript
type EdgeType = 
  | 'PARENT_OF'      // Jerarquía: padre -> hijo
  | 'CHILD_OF'       // Jerarquía: hijo -> padre
  | 'NEXT_SIBLING'   // Navegación: hermano -> siguiente
  | 'PREV_SIBLING'   // Navegación: hermano -> anterior
  | 'SAME_TOPIC'     // Semántica: sección ~ sección (cross-doc)
  | 'REFERS_TO';     // Referencia: sección -> sección

interface Edge {
  from_node_id: string;
  to_node_id: string;
  type: EdgeType;
  weight?: number;  // Ej: similitud para SAME_TOPIC
  metadata?: any;   // Información adicional
}
```

#### Schema SQLite
```sql
-- Tabla de aristas (edges)
CREATE TABLE IF NOT EXISTS edges (
  from_node_id TEXT NOT NULL,
  to_node_id   TEXT NOT NULL,
  type         TEXT NOT NULL,
  weight       REAL,
  metadata     TEXT,  -- JSON
  created_at   TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (from_node_id, to_node_id, type)
);

-- Índices para navegación rápida
CREATE INDEX IF NOT EXISTS idx_edges_from ON edges(from_node_id, type);
CREATE INDEX IF NOT EXISTS idx_edges_to ON edges(to_node_id, type);
CREATE INDEX IF NOT EXISTS idx_edges_type ON edges(type);
```

### Fase 2: Entidades y Conceptos (Futuro)

#### Tipos de Nodos Adicionales
- `Concept`: Conceptos extraídos (ej: "L2 regularization", "JWT")
- `Entity`: Entidades nombradas (personas, organizaciones, etc.)
- `Example`: Ejemplos de código
- `Definition`: Definiciones formales

#### Tipos de Aristas Adicionales
- `MENTIONS`: Section -> Concept
- `DEFINES`: Section -> Concept
- `EXAMPLE_OF`: Example -> Concept
- `ALIASES`: Concept -> Concept (sinónimos)
- `RELATED_TO`: Concept -> Concept

---

## RAG sobre Grafo: Estrategia Híbrida

### 1. Vector Search Inicial (Semilla)
```
Query → Embeddings → KNN Search → Top K Sections (semillas)
```

### 2. Expansión en el Grafo
Desde cada sección semilla, expandir usando aristas:

```typescript
interface GraphExpansionConfig {
  maxHops: number;           // Número máximo de saltos (1-2)
  maxNodes: number;          // Máximo de nodos a recuperar
  edgeTypes: EdgeType[];     // Tipos de aristas a seguir
  weights: {
    [key in EdgeType]?: number;  // Peso por tipo de arista
  };
}
```

**Ejemplo de expansión:**
```
Semilla: Section("Deep Learning")
  → PARENT_OF → Section("Machine Learning")  [hop 1]
  → SAME_TOPIC → Section("Neural Networks") [hop 1, otro doc]
  → CHILD_OF → Section("CNN")               [hop 2]
  → REFERS_TO → Section("Backpropagation")  [hop 2, cross-doc]
```

### 3. Construcción del Subgrafo
- Limitar por número de hops
- Limitar por número total de nodos
- Filtrar por tipo de arista
- Ponderar por peso de arista

### 4. Reranking y Contexto
- Ordenar nodos por:
  - Distancia a la semilla (en hops)
  - Peso de las aristas
  - Tipo de relación
  - Score de embedding
- Construir contexto jerárquico:
  ```
  [Documento X]
    [Capítulo Y]
      → Sección semilla (score: 0.95)
      → Sección relacionada (SAME_TOPIC, score: 0.87)
  [Documento Z]
    [Capítulo W]
      → Definición (REFERS_TO, score: 0.82)
  ```

---

## Detección Automática de Relaciones

### Algoritmo SAME_TOPIC (Similitud de Embeddings)

```typescript
interface SameTopicConfig {
  minSimilarity: number;     // Umbral de similitud (0.7-0.9)
  maxConnections: number;    // Máximo de conexiones por nodo
  crossDocOnly: boolean;     // Solo cross-document
  titleSimilarity: boolean;  // Considerar similitud de títulos
}

async function detectSameTopicEdges(config: SameTopicConfig): Promise<Edge[]> {
  // 1. Obtener todas las secciones con embeddings
  const sections = await getAllSections();
  
  // 2. Para cada par de secciones
  const edges: Edge[] = [];
  for (let i = 0; i < sections.length; i++) {
    for (let j = i + 1; j < sections.length; j++) {
      const s1 = sections[i];
      const s2 = sections[j];
      
      // Skip si es mismo documento y config.crossDocOnly
      if (config.crossDocOnly && s1.doc_id === s2.doc_id) continue;
      
      // Calcular similitud
      const similarity = cosineSimilarity(s1.embedding, s2.embedding);
      
      // Si supera umbral, crear edge bidireccional
      if (similarity >= config.minSimilarity) {
        edges.push({
          from_node_id: s1.node_id,
          to_node_id: s2.node_id,
          type: 'SAME_TOPIC',
          weight: similarity
        });
        edges.push({
          from_node_id: s2.node_id,
          to_node_id: s1.node_id,
          type: 'SAME_TOPIC',
          weight: similarity
        });
      }
    }
  }
  
  // 3. Limitar conexiones por nodo (top K por similitud)
  return limitConnectionsPerNode(edges, config.maxConnections);
}
```

### Detección de REFERS_TO (Enlaces Explícitos)

```typescript
// Detectar links markdown: [texto](url) o [[wikilink]]
function detectReferences(section: Section): Edge[] {
  const edges: Edge[] = [];
  const content = section.content.join('\n');
  
  // Regex para [texto](path/to/doc#section-id)
  const markdownLinks = content.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g);
  
  for (const match of markdownLinks) {
    const [_, text, link] = match;
    
    // Resolver link a node_id
    const targetNodeId = resolveLink(link);
    if (targetNodeId) {
      edges.push({
        from_node_id: section.node_id,
        to_node_id: targetNodeId,
        type: 'REFERS_TO',
        metadata: { linkText: text }
      });
    }
  }
  
  return edges;
}
```

---

## Beneficios por Escenario

### Escenario 1: Base de Conocimiento Pequeña (1-10 docs)
**Jerarquía (actual) es suficiente**
- Contexto local: sección + padre + hermanos
- Simple de mantener
- Bajo overhead

**Grafo agrega poco valor aquí**

### Escenario 2: Documentación Técnica (10-100 docs)
**Grafo empieza a brillar**
- Múltiples guías sobre mismo tema
- SAME_TOPIC conecta definiciones en distintos docs
- REFERS_TO permite seguir referencias cross-doc

**Ejemplo:**
```
Query: "¿Cómo funciona JWT?"
→ Semilla: "docs/security.md#jwt-authentication"
→ SAME_TOPIC → "docs/api.md#authentication"
→ REFERS_TO → "docs/examples/jwt-example.md"
→ Contexto rico con 3 perspectivas
```

### Escenario 3: Knowledge Base Empresarial (100+ docs)
**Grafo es esencial**
- RFCs, ADRs, tickets, wikis, código
- Multi-hop reasoning:
  ```
  Pregunta → Resumen → RFC → Decisión → Implementación → Código
  ```
- Diversidad de contexto:
  - Definición formal (RFC)
  - Ejemplo práctico (docs)
  - Código real (repo)

---

## Implementación: Roadmap

### Fase 1.0: Fundamentos (ACTUAL)
✅ Árbol por documento  
✅ Vector search con SQLite  
✅ Contexto jerárquico (padre + hermanos)

### Fase 1.5: Grafo Básico (PRÓXIMO)
- [ ] Tabla `edges` en SQLite
- [ ] Migrar relaciones jerárquicas a edges:
  - PARENT_OF / CHILD_OF
  - NEXT_SIBLING / PREV_SIBLING
- [ ] API para crear/consultar edges
- [ ] Función `detectSameTopicEdges()`
- [ ] RAG engine con expansión 1-hop

### Fase 2.0: Grafo Avanzado
- [ ] Detección automática de REFERS_TO (markdown links)
- [ ] Expansión multi-hop (2-3 saltos)
- [ ] Reranking por tipo de arista
- [ ] Visualización del grafo (API endpoint)

### Fase 3.0: Entidades y Conceptos
- [ ] Extracción de entidades (NER)
- [ ] Nodos `Concept`
- [ ] Aristas MENTIONS, DEFINES
- [ ] Graph embeddings

---

## Trade-offs

### Ventajas
✅ **Contexto más rico**: No limitado a un solo documento  
✅ **Multi-hop reasoning**: Seguir cadenas de referencias  
✅ **Descubrimiento**: Encontrar contenido relacionado no obvio  
✅ **Escalable**: Funciona mejor con más documentos  
✅ **Sin cambio de stack**: Sigue siendo SQLite + lowdb

### Desventajas
❌ **Complejidad**: Más código, más estados  
❌ **Mantenimiento de edges**: Hay que decidir qué conectar  
❌ **Riesgo de ruido**: Grafo muy denso = contexto irrelevante  
❌ **Performance**: Expansión de grafo puede ser costosa

### Mitigaciones
- **Empezar simple**: Solo PARENT_OF + SAME_TOPIC
- **Limitar expansión**: Max 2 hops, max 20 nodos
- **Umbrales altos**: Similitud > 0.8 para SAME_TOPIC
- **Índices**: SQLite bien indexado es rápido
- **Lazy creation**: Crear edges on-demand, no todo upfront

---

## Ejemplos de Uso

### Ejemplo 1: Búsqueda Simple (Fase 1.0)
```typescript
// Query: "What is supervised learning?"
const results = await ragEngine.query("What is supervised learning?", { k: 3 });

// Resultado (solo vector search):
// 1. ml-guide.md#supervised-learning (score: 0.95)
// 2. ml-guide.md#introduction (score: 0.78)
// 3. ml-guide.md#classification (score: 0.72)
```

### Ejemplo 2: Búsqueda con Grafo (Fase 1.5)
```typescript
// Query: "What is supervised learning?"
const results = await ragEngine.queryGraph("What is supervised learning?", {
  k: 3,
  expansion: {
    maxHops: 1,
    maxNodes: 10,
    edgeTypes: ['PARENT_OF', 'CHILD_OF', 'SAME_TOPIC']
  }
});

// Resultado (vector + graph):
// Semillas:
// 1. ml-guide.md#supervised-learning (score: 0.95)
//
// Expansión:
// → PARENT_OF → ml-guide.md#machine-learning (context)
// → CHILD_OF → ml-guide.md#classification (example)
// → CHILD_OF → ml-guide.md#regression (example)
// → SAME_TOPIC → ai-basics.md#learning-types (cross-doc, score: 0.87)
//
// Contexto final: 5 secciones con perspectivas múltiples
```

### Ejemplo 3: Multi-hop Reasoning (Fase 2.0)
```typescript
// Query: "How was neural networks history?"
const results = await ragEngine.queryGraph("How was neural networks history?", {
  k: 2,
  expansion: {
    maxHops: 2,
    maxNodes: 15,
    edgeTypes: ['PARENT_OF', 'SAME_TOPIC', 'REFERS_TO']
  }
});

// Resultado:
// Semillas:
// 1. ai-history.md#deep-learning (score: 0.92)
// 2. ml-guide.md#neural-networks (score: 0.88)
//
// Expansión hop 1:
// → PARENT_OF → ai-history.md#ai-history (context)
// → SAME_TOPIC → ml-guide.md#deep-learning (cross-doc)
// → REFERS_TO → ai-history.md#perceptron (historical reference)
//
// Expansión hop 2:
// → PARENT_OF → ml-guide.md#machine-learning (broader context)
// → REFERS_TO → ai-history.md#geoffrey-hinton (key figure)
//
// Contexto final: Timeline histórico + explicaciones técnicas + figuras clave
```

---

## Conclusión

**hereltical-rag** puede evolucionar gradualmente de árbol a grafo:

1. **Hoy**: Jerarquía funcional para pocos documentos
2. **Mañana**: Grafo básico con SAME_TOPIC para cross-doc
3. **Futuro**: Grafo rico con entidades, conceptos, multi-hop

La clave es:
- ✅ **No romper el stack**: SQLite + lowdb siguen
- ✅ **Evolución gradual**: Fase por fase
- ✅ **Valor incremental**: Cada fase agrega utilidad real
- ✅ **Sin over-engineering**: Solo lo que necesites

**Próximo paso:** Implementar `edges` table + `detectSameTopicEdges()`

---

**Documento**: `docs/GRAPH_EVOLUTION.md`  
**Versión**: 1.0  
**Fecha**: Noviembre 2024  
**Estado**: Diseño conceptual - Listo para implementación

