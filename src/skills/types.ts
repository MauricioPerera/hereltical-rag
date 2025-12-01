/**
 * Skill Bank - Unified Types
 * 
 * Tipos para el sistema de Skill Bank donde tools (capacidades ejecutables)
 * y skills (recetas de como usar las tools) se indexan y relacionan via RAG + Grafo
 */

// ============================================================================
// CORE ENTITY TYPES
// ============================================================================

export type EntityType = 'tool' | 'skill';

/**
 * Tool - Capacidad ejecutable del sistema
 */
export interface Tool {
  id: string;
  name: string;
  type: 'tool';
  
  description: string;           // Descripcion detallada para embedding
  category: string;              // http, filesystem, execution, data, ai
  tags?: string[];
  
  // Schema de ejecucion
  inputSchema: JSONSchema;       // Parametros que acepta
  outputSchema: JSONSchema;      // Que retorna
  
  // Implementacion
  implementation: ToolImplementation;
  
  // Metadata
  examples?: ToolExample[];
  limitations?: string[];
  costPerCall?: number;          // Costo estimado (para tracking)
  version?: string;
}

/**
 * Skill - Receta de como usar tools para lograr un objetivo
 */
export interface Skill {
  id: string;
  name: string;
  type: 'skill';
  category: string;
  tags?: string[];
  version?: string;
  
  // Tipo de skill (NUEVO!)
  skillType?: 'tool_based' | 'instructional' | 'context_aware' | 'hybrid';
  
  // Contexto rico para embedding y comprension
  overview: string;              // Que hace esta skill
  
  instructions: {
    steps: string[];             // Como ejecutar (paso a paso)
    prerequisites: string[];     // Que debe existir antes
    bestPractices: string[];     // Recomendaciones
    antiPatterns: string[];      // Que NO hacer
    methodology?: string;        // Metodología (para instructional)
  };
  
  // Para tool-based skills
  usesTools: string[];           // IDs de tools que utiliza (puede estar vacío ahora)
  
  // Para instructional skills (NUEVO!)
  nativeCapabilities?: string[]; // Capacidades nativas del LLM
  template?: string;             // Plantilla/formato a seguir
  
  // Para context-aware skills (NUEVO!)
  referencesDocuments?: string[]; // IDs de documentos en el RAG
  ragIntegration?: {
    endpoint: string;            // Endpoint del RAG a usar
    filters?: Record<string, any>; // Filtros para búsqueda
    strategy?: string;           // Estrategia de búsqueda
  };
  
  // I/O de la skill
  parameters: SkillParam[];
  outputs: SkillOutput[];
  examples: SkillExample[];
  
  errorHandling?: {
    commonErrors: string[];
    recovery: string[];
  };
  
  // Metadata adicional
  requiresExternalServices?: boolean; // false para instructional
}

// ============================================================================
// SUPPORTING TYPES
// ============================================================================

/**
 * JSON Schema simplificado
 */
export interface JSONSchema {
  type: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null' | 'any';
  properties?: Record<string, JSONSchemaProperty>;
  required?: string[];
  items?: JSONSchema;
  enum?: any[];
  description?: string;
}

export interface JSONSchemaProperty {
  type: string;
  description?: string;
  enum?: any[];
  required?: boolean;
  default?: any;
}

/**
 * Implementacion de una tool
 */
export interface ToolImplementation {
  type: 'internal' | 'api' | 'function';
  ref: string;                   // Referencia: endpoint, path a funcion, etc.
  config?: Record<string, any>;  // Configuracion adicional
}

/**
 * Ejemplo de uso de una tool
 */
export interface ToolExample {
  description: string;
  input: Record<string, any>;
  expectedOutput: any;
  notes?: string;
}

/**
 * Parametro de una skill
 */
export interface SkillParam {
  name: string;
  type: string;
  required: boolean;
  description: string;
  enum?: any[];
  default?: any;
}

/**
 * Output de una skill
 */
export interface SkillOutput {
  name: string;
  type: string;
  description: string;
}

/**
 * Ejemplo de uso de una skill
 */
export interface SkillExample {
  situation: string;             // Contexto del caso de uso
  input: Record<string, any>;
  expectedOutput: string;
  notes?: string;
}

// ============================================================================
// GRAPH TYPES
// ============================================================================

/**
 * Tipos de edges en el grafo
 */
export type EdgeType = 
  | 'ENABLES'              // TOOL enables SKILL
  | 'USES'                 // SKILL uses TOOL
  | 'REQUIRES'             // SKILL requires SKILL
  | 'PRODUCES_INPUT_FOR'   // SKILL produces input for SKILL
  | 'SIMILAR_TO'           // TOOL/SKILL similar to TOOL/SKILL
  | 'ALTERNATIVE_TO'       // Intercambiables
  | 'COMPLEMENTS';         // Funcionan bien juntas

/**
 * Edge en el grafo de entidades
 */
export interface EntityEdge {
  fromId: string;
  toId: string;
  type: EdgeType;
  weight?: number;               // 0.0 - 1.0
  metadata?: Record<string, any>;
  createdAt?: string;
}

// ============================================================================
// SKILL BANK API TYPES
// ============================================================================

/**
 * Parametros para discover
 */
export interface DiscoverParams {
  query: string;                 // Que necesita hacer el agente
  mode?: 'tools' | 'skills' | 'all';
  expandGraph?: boolean;         // Incluir entidades relacionadas via grafo
  k?: number;                    // Max resultados
  categories?: string[];         // Filtrar por categoria
}

/**
 * Resultado de discovery
 */
export interface DiscoveryResult {
  query: string;
  tools: DiscoveredTool[];
  skills: DiscoveredSkill[];
  suggestedFlow?: SuggestedFlow; // Secuencia sugerida por el grafo
  metadata: {
    timestamp: string;
    usedGraph: boolean;
    resultsCount: number;
  };
}

/**
 * Tool descubierta
 */
export interface DiscoveredTool {
  tool: Tool;
  relevance: number;             // Score de similitud (0-1)
  source: 'vector' | 'graph';    // Como se encontro
  relatedTo?: string;            // ID de entidad relacionada (si vino por grafo)
  hopDistance?: number;          // Distancia en grafo desde seed
}

/**
 * Skill descubierta
 */
export interface DiscoveredSkill {
  skill: Skill;
  relevance: number;
  compatibility: number;         // % de tools requeridas que estan disponibles
  source: 'vector' | 'graph';
  relatedTo?: string;
  hopDistance?: number;
  missingTools?: string[];       // Tools requeridas no disponibles
}

/**
 * Flujo sugerido por el grafo
 */
export interface SuggestedFlow {
  steps: FlowStep[];
  confidence: number;            // Confianza del grafo en este flujo
}

export interface FlowStep {
  entityId: string;
  entityType: EntityType;
  order: number;
  reasoning?: string;            // Por que esta en el flujo
}

/**
 * Parametros para execute
 */
export interface ExecuteParams {
  targetId: string;              // ID de tool o skill
  targetType: EntityType;
  input: Record<string, any>;
  options?: {
    timeout?: number;
    retries?: number;
    dryRun?: boolean;            // Solo simular, no ejecutar
  };
}

/**
 * Resultado de ejecucion
 */
export interface ExecutionResult {
  success: boolean;
  output: any;
  toolsUsed: string[];           // Tools que se invocaron
  logs?: ExecutionLog[];
  error?: ExecutionError;
  metadata: {
    executionTime: number;       // ms
    timestamp: string;
  };
}

export interface ExecutionLog {
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  timestamp: string;
  context?: Record<string, any>;
}

export interface ExecutionError {
  code: string;
  message: string;
  details?: any;
  recoverable: boolean;
}

// ============================================================================
// STORE TYPES
// ============================================================================

/**
 * Entidad unificada (Tool o Skill) para almacenamiento
 */
export interface StoredEntity {
  id: string;
  type: EntityType;
  name: string;
  category: string;
  data: Tool | Skill;            // Datos completos
  embedding?: number[];          // Vector embedding
  hash?: string;                 // Hash del contenido para change detection
  createdAt: string;
  updatedAt: string;
}

/**
 * Filtros para busqueda
 */
export interface SearchFilters {
  type?: EntityType;
  category?: string;
  tags?: string[];
  usesTool?: string;             // Filtra skills que usan esta tool
}

/**
 * Resultado de busqueda vectorial
 */
export interface VectorSearchResult {
  entityId: string;
  type: EntityType;
  distance: number;
}

/**
 * Nodo expandido del grafo
 */
export interface ExpandedGraphNode {
  entityId: string;
  type: EntityType;
  hop: number;                   // Distancia desde seed
  edgeType?: EdgeType;
  weight?: number;
  path: string[];                // Camino desde seed
}

/**
 * Configuracion de expansion de grafo
 */
export interface GraphExpansionConfig {
  maxHops: number;               // 1-3
  maxNodes: number;              // Limite de nodos a retornar
  edgeTypes: EdgeType[];         // Tipos de edges a seguir
  minWeight?: number;            // Peso minimo de edges
}

