/**
 * Entity Extractor - Lightweight NER for knowledge graph enrichment
 * 
 * Extracts entities from text using pattern-based rules (no ML dependencies).
 * Supports: technical terms, code references, proper nouns, acronyms.
 */

export type EntityType = 
  | 'TECHNOLOGY'      // Programming languages, frameworks, tools
  | 'CONCEPT'         // Abstract concepts, methodologies
  | 'ACRONYM'         // API, REST, SQL, etc.
  | 'CODE_REFERENCE'  // function names, class names, variables
  | 'PROPER_NOUN'     // Names, organizations
  | 'METRIC'          // Numbers with units
  | 'VERSION';        // Version numbers (v1.0, 2.3.1)

export interface Entity {
  text: string;           // Original text
  normalized: string;     // Lowercase, trimmed
  type: EntityType;
  confidence: number;     // 0-1
  positions: number[];    // Character positions in source
  frequency: number;      // How many times it appears
  metadata?: Record<string, unknown>;
}

export interface ExtractionResult {
  entities: Entity[];
  concepts: string[];     // Unique concept names
  technologies: string[]; // Unique tech names
  stats: {
    totalEntities: number;
    uniqueEntities: number;
    byType: Record<EntityType, number>;
  };
}

// Known technology terms (expandable)
const TECHNOLOGIES = new Set([
  // Languages
  'javascript', 'typescript', 'python', 'java', 'rust', 'go', 'c++', 'c#',
  'ruby', 'php', 'swift', 'kotlin', 'scala', 'haskell', 'elixir', 'clojure',
  // Frameworks & Libraries
  'react', 'vue', 'angular', 'svelte', 'next.js', 'nuxt', 'express', 'fastapi',
  'django', 'flask', 'spring', 'rails', 'laravel', 'node.js', 'deno', 'bun',
  // Databases
  'postgresql', 'mysql', 'mongodb', 'redis', 'sqlite', 'elasticsearch',
  'neo4j', 'cassandra', 'dynamodb', 'firebase', 'supabase',
  // AI/ML
  'tensorflow', 'pytorch', 'keras', 'scikit-learn', 'huggingface', 'langchain',
  'openai', 'anthropic', 'ollama', 'llama', 'gpt', 'bert', 'transformer',
  // Tools
  'docker', 'kubernetes', 'git', 'github', 'gitlab', 'jenkins', 'terraform',
  'aws', 'azure', 'gcp', 'vercel', 'netlify', 'heroku',
  // Concepts
  'api', 'rest', 'graphql', 'grpc', 'websocket', 'oauth', 'jwt',
  'microservices', 'serverless', 'ci/cd', 'devops', 'agile', 'scrum'
]);

// Common CS/ML concepts
const CONCEPTS = new Set([
  // ML/AI
  'machine learning', 'deep learning', 'neural network', 'gradient descent',
  'backpropagation', 'embedding', 'vector', 'cosine similarity', 'attention',
  'transformer', 'encoder', 'decoder', 'tokenization', 'fine-tuning',
  'transfer learning', 'reinforcement learning', 'supervised learning',
  'unsupervised learning', 'classification', 'regression', 'clustering',
  'dimensionality reduction', 'feature extraction', 'overfitting', 'underfitting',
  // Data structures
  'array', 'linked list', 'hash table', 'binary tree', 'graph', 'heap',
  'stack', 'queue', 'trie', 'bloom filter',
  // Algorithms
  'sorting', 'searching', 'dynamic programming', 'recursion', 'memoization',
  'breadth-first search', 'depth-first search', 'dijkstra', 'a*',
  // Architecture
  'microservices', 'monolith', 'event-driven', 'cqrs', 'event sourcing',
  'domain-driven design', 'clean architecture', 'hexagonal architecture',
  // RAG specific
  'retrieval augmented generation', 'rag', 'semantic search', 'vector database',
  'knowledge graph', 'entity extraction', 'named entity recognition', 'ner',
  'chunking', 'reranking', 'hybrid search'
]);

/**
 * Extract entities from text
 */
export function extractEntities(text: string): ExtractionResult {
  const entities: Entity[] = [];
  const entityMap = new Map<string, Entity>();
  
  // 1. Extract code references (backticks, camelCase, snake_case)
  extractCodeReferences(text, entityMap);
  
  // 2. Extract acronyms (2-5 uppercase letters)
  extractAcronyms(text, entityMap);
  
  // 3. Extract known technologies
  extractTechnologies(text, entityMap);
  
  // 4. Extract known concepts (multi-word)
  extractConcepts(text, entityMap);
  
  // 5. Extract version numbers
  extractVersions(text, entityMap);
  
  // 6. Extract metrics (numbers with units)
  extractMetrics(text, entityMap);
  
  // 7. Extract capitalized terms (potential proper nouns/concepts)
  extractCapitalizedTerms(text, entityMap);
  
  // Convert map to array and sort by frequency
  for (const entity of entityMap.values()) {
    entities.push(entity);
  }
  entities.sort((a, b) => b.frequency - a.frequency);
  
  // Build stats
  const byType: Record<EntityType, number> = {
    TECHNOLOGY: 0,
    CONCEPT: 0,
    ACRONYM: 0,
    CODE_REFERENCE: 0,
    PROPER_NOUN: 0,
    METRIC: 0,
    VERSION: 0
  };
  
  for (const e of entities) {
    byType[e.type]++;
  }
  
  return {
    entities,
    concepts: entities
      .filter(e => e.type === 'CONCEPT')
      .map(e => e.normalized),
    technologies: entities
      .filter(e => e.type === 'TECHNOLOGY')
      .map(e => e.normalized),
    stats: {
      totalEntities: entities.reduce((sum, e) => sum + e.frequency, 0),
      uniqueEntities: entities.length,
      byType
    }
  };
}

function addEntity(
  map: Map<string, Entity>,
  text: string,
  type: EntityType,
  position: number,
  confidence: number = 0.8
) {
  const normalized = text.toLowerCase().trim();
  if (normalized.length < 2) return;
  
  const existing = map.get(normalized);
  if (existing) {
    existing.frequency++;
    existing.positions.push(position);
    // Boost confidence with frequency
    existing.confidence = Math.min(1, existing.confidence + 0.05);
  } else {
    map.set(normalized, {
      text,
      normalized,
      type,
      confidence,
      positions: [position],
      frequency: 1
    });
  }
}

function extractCodeReferences(text: string, map: Map<string, Entity>) {
  // Backtick code references
  const backtickRegex = /`([^`]+)`/g;
  let match;
  while ((match = backtickRegex.exec(text)) !== null) {
    addEntity(map, match[1], 'CODE_REFERENCE', match.index, 0.95);
  }
  
  // CamelCase (but not all caps or single word)
  const camelRegex = /\b([A-Z][a-z]+(?:[A-Z][a-z]+)+)\b/g;
  while ((match = camelRegex.exec(text)) !== null) {
    addEntity(map, match[1], 'CODE_REFERENCE', match.index, 0.7);
  }
  
  // snake_case and SCREAMING_SNAKE_CASE
  const snakeRegex = /\b([a-z]+(?:_[a-z]+)+|[A-Z]+(?:_[A-Z]+)+)\b/g;
  while ((match = snakeRegex.exec(text)) !== null) {
    addEntity(map, match[1], 'CODE_REFERENCE', match.index, 0.75);
  }
}

function extractAcronyms(text: string, map: Map<string, Entity>) {
  // 2-6 letter acronyms (uppercase)
  const acronymRegex = /\b([A-Z]{2,6})\b/g;
  let match;
  while ((match = acronymRegex.exec(text)) !== null) {
    // Skip if it's a known technology (handle separately)
    if (!TECHNOLOGIES.has(match[1].toLowerCase())) {
      addEntity(map, match[1], 'ACRONYM', match.index, 0.6);
    }
  }
}

function extractTechnologies(text: string, map: Map<string, Entity>) {
  const lowerText = text.toLowerCase();
  
  for (const tech of TECHNOLOGIES) {
    // Word boundary match
    const regex = new RegExp(`\\b${escapeRegex(tech)}\\b`, 'gi');
    let match;
    while ((match = regex.exec(lowerText)) !== null) {
      addEntity(map, match[0], 'TECHNOLOGY', match.index, 0.9);
    }
  }
}

function extractConcepts(text: string, map: Map<string, Entity>) {
  const lowerText = text.toLowerCase();
  
  for (const concept of CONCEPTS) {
    const regex = new RegExp(`\\b${escapeRegex(concept)}\\b`, 'gi');
    let match;
    while ((match = regex.exec(lowerText)) !== null) {
      addEntity(map, match[0], 'CONCEPT', match.index, 0.85);
    }
  }
}

function extractVersions(text: string, map: Map<string, Entity>) {
  // Version patterns: v1.0, 1.2.3, version 2.0
  const versionRegex = /\b(?:v|version\s*)?([\d]+\.[\d]+(?:\.[\d]+)?(?:-[a-z]+)?)\b/gi;
  let match;
  while ((match = versionRegex.exec(text)) !== null) {
    addEntity(map, match[0], 'VERSION', match.index, 0.9);
  }
}

function extractMetrics(text: string, map: Map<string, Entity>) {
  // Numbers with units: 100ms, 50%, 1.5GB, 10K
  const metricRegex = /\b(\d+(?:\.\d+)?)\s*(ms|s|min|h|%|kb|mb|gb|tb|k|m|b)\b/gi;
  let match;
  while ((match = metricRegex.exec(text)) !== null) {
    addEntity(map, match[0], 'METRIC', match.index, 0.8);
  }
}

function extractCapitalizedTerms(text: string, map: Map<string, Entity>) {
  // Capitalized words that might be proper nouns or important terms
  // Skip common sentence starters
  const skipWords = new Set(['the', 'a', 'an', 'this', 'that', 'these', 'those', 'it', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'also']);
  
  // Match capitalized words not at sentence start
  const capitalRegex = /(?<=[.!?]\s+|^)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g;
  let match;
  while ((match = capitalRegex.exec(text)) !== null) {
    const word = match[1].toLowerCase();
    if (!skipWords.has(word) && word.length > 2) {
      // Check if already captured as tech or concept
      if (!map.has(word)) {
        addEntity(map, match[1], 'PROPER_NOUN', match.index, 0.5);
      }
    }
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Extract and deduplicate concepts across multiple texts
 */
export function extractConceptsFromTexts(texts: string[]): ExtractionResult {
  const combinedMap = new Map<string, Entity>();
  
  for (const text of texts) {
    const result = extractEntities(text);
    for (const entity of result.entities) {
      const existing = combinedMap.get(entity.normalized);
      if (existing) {
        existing.frequency += entity.frequency;
        existing.positions.push(...entity.positions);
        existing.confidence = Math.min(1, existing.confidence + 0.02);
      } else {
        combinedMap.set(entity.normalized, { ...entity });
      }
    }
  }
  
  const entities = Array.from(combinedMap.values())
    .sort((a, b) => b.frequency - a.frequency);
  
  const byType: Record<EntityType, number> = {
    TECHNOLOGY: 0,
    CONCEPT: 0,
    ACRONYM: 0,
    CODE_REFERENCE: 0,
    PROPER_NOUN: 0,
    METRIC: 0,
    VERSION: 0
  };
  
  for (const e of entities) {
    byType[e.type]++;
  }
  
  return {
    entities,
    concepts: entities.filter(e => e.type === 'CONCEPT').map(e => e.normalized),
    technologies: entities.filter(e => e.type === 'TECHNOLOGY').map(e => e.normalized),
    stats: {
      totalEntities: entities.reduce((sum, e) => sum + e.frequency, 0),
      uniqueEntities: entities.length,
      byType
    }
  };
}

