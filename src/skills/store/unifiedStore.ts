/**
 * Unified Store - Storage para Tools y Skills
 * 
 * Maneja almacenamiento, embeddings y grafo de relaciones para ambas entidades
 */

import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import crypto from 'crypto';
import {
  Tool,
  Skill,
  EntityType,
  StoredEntity,
  EntityEdge,
  EdgeType,
  VectorSearchResult,
  SearchFilters
} from '../types.js';

let DB_PATH = 'skillbank.db';
let dbInstance: Database.Database | null = null;

/**
 * Configurar path de BD (para testing)
 */
export function setDbPath(path: string) {
  if (dbInstance) {
    throw new Error('Cannot change DB path after database is initialized. Call closeDb() first.');
  }
  DB_PATH = path;
}

/**
 * Cerrar conexion
 */
export function closeDb() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

/**
 * Obtener instancia de BD
 */
export function getDb(): Database.Database {
  if (dbInstance) return dbInstance;

  dbInstance = new Database(DB_PATH);
  sqliteVec.load(dbInstance);

  // Crear tablas
  dbInstance.exec(`
    -- Entidades (tools + skills)
    CREATE TABLE IF NOT EXISTS entities (
      id         TEXT PRIMARY KEY,
      type       TEXT NOT NULL,
      name       TEXT NOT NULL,
      category   TEXT NOT NULL,
      data       TEXT NOT NULL,      -- JSON completo
      hash       TEXT,                -- SHA-256 para change detection
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type);
    CREATE INDEX IF NOT EXISTS idx_entities_category ON entities(category);

    -- Vector embeddings
    CREATE VIRTUAL TABLE IF NOT EXISTS vec_entities USING vec0(
      entity_id TEXT PRIMARY KEY,
      embedding FLOAT[2048]
    );

    -- Grafo de relaciones
    CREATE TABLE IF NOT EXISTS entity_edges (
      from_id    TEXT NOT NULL,
      to_id      TEXT NOT NULL,
      type       TEXT NOT NULL,
      weight     REAL DEFAULT 1.0,
      metadata   TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (from_id, to_id, type)
    );

    CREATE INDEX IF NOT EXISTS idx_edges_from ON entity_edges(from_id, type);
    CREATE INDEX IF NOT EXISTS idx_edges_to ON entity_edges(to_id, type);
    CREATE INDEX IF NOT EXISTS idx_edges_type ON entity_edges(type);
  `);

  return dbInstance;
}

/**
 * Calcular hash de una entidad
 */
function hashEntity(entity: Tool | Skill): string {
  const data = JSON.stringify(entity);
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Padding de embeddings
 */
function padEmbedding(embedding: number[], targetDims: number): number[] {
  if (embedding.length >= targetDims) {
    return embedding.slice(0, targetDims);
  }
  const padded = new Array(targetDims).fill(0);
  for (let i = 0; i < embedding.length; i++) {
    padded[i] = embedding[i];
  }
  return padded;
}

// ============================================================================
// ENTITY CRUD
// ============================================================================

/**
 * Registrar o actualizar una tool
 */
export function upsertTool(tool: Tool, embedding: number[]): void {
  const db = getDb();
  const hash = hashEntity(tool);

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO entities (id, type, name, category, data, hash, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
  `);

  stmt.run(
    tool.id,
    'tool',
    tool.name,
    tool.category,
    JSON.stringify(tool),
    hash
  );

  // Insertar embedding (vec_entities no soporta REPLACE, necesitamos DELETE + INSERT)
  const paddedEmbedding = padEmbedding(embedding, 2048);
  const buffer = Buffer.from(new Float32Array(paddedEmbedding).buffer);

  // Eliminar embedding previo si existe
  db.prepare('DELETE FROM vec_entities WHERE entity_id = ?').run(tool.id);
  
  // Insertar nuevo embedding
  const vecStmt = db.prepare(`
    INSERT INTO vec_entities(entity_id, embedding)
    VALUES (?, ?)
  `);
  vecStmt.run(tool.id, buffer);

  // Crear edge ENABLES automaticamente (tool enables cualquier skill que la use)
  // Esto se manejara cuando se registre la skill
}

/**
 * Registrar o actualizar una skill
 */
export function upsertSkill(skill: Skill, embedding: number[]): void {
  const db = getDb();
  const hash = hashEntity(skill);

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO entities (id, type, name, category, data, hash, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
  `);

  stmt.run(
    skill.id,
    'skill',
    skill.name,
    skill.category,
    JSON.stringify(skill),
    hash
  );

  // Insertar embedding (vec_entities no soporta REPLACE, necesitamos DELETE + INSERT)
  const paddedEmbedding = padEmbedding(embedding, 2048);
  const buffer = Buffer.from(new Float32Array(paddedEmbedding).buffer);

  // Eliminar embedding previo si existe
  db.prepare('DELETE FROM vec_entities WHERE entity_id = ?').run(skill.id);
  
  // Insertar nuevo embedding
  const vecStmt = db.prepare(`
    INSERT INTO vec_entities(entity_id, embedding)
    VALUES (?, ?)
  `);
  vecStmt.run(skill.id, buffer);

  // Crear edges automaticos: SKILL USES TOOL
  for (const toolId of skill.usesTools) {
    addEdge({
      fromId: skill.id,
      toId: toolId,
      type: 'USES',
      weight: 1.0
    });
    
    // Y el inverso: TOOL ENABLES SKILL
    addEdge({
      fromId: toolId,
      toId: skill.id,
      type: 'ENABLES',
      weight: 1.0
    });
  }
}

/**
 * Obtener entidad por ID
 */
export function getEntity(id: string): StoredEntity | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM entities WHERE id = ?').get(id) as any;
  
  if (!row) return null;

  return {
    id: row.id,
    type: row.type as EntityType,
    name: row.name,
    category: row.category,
    data: JSON.parse(row.data),
    hash: row.hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * Obtener tool por ID
 */
export function getTool(id: string): Tool | null {
  const entity = getEntity(id);
  if (!entity || entity.type !== 'tool') return null;
  return entity.data as Tool;
}

/**
 * Obtener skill por ID
 */
export function getSkill(id: string): Skill | null {
  const entity = getEntity(id);
  if (!entity || entity.type !== 'skill') return null;
  return entity.data as Skill;
}

/**
 * Listar todas las entidades de un tipo
 */
export function listEntities(type?: EntityType): StoredEntity[] {
  const db = getDb();
  
  const query = type 
    ? 'SELECT * FROM entities WHERE type = ? ORDER BY name'
    : 'SELECT * FROM entities ORDER BY type, name';
  
  const stmt = type ? db.prepare(query) : db.prepare(query);
  const rows = type ? stmt.all(type) : stmt.all();

  return (rows as any[]).map(row => ({
    id: row.id,
    type: row.type as EntityType,
    name: row.name,
    category: row.category,
    data: JSON.parse(row.data),
    hash: row.hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
}

/**
 * Eliminar entidad
 */
export function deleteEntity(id: string): void {
  const db = getDb();
  
  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM entities WHERE id = ?').run(id);
    db.prepare('DELETE FROM vec_entities WHERE entity_id = ?').run(id);
    db.prepare('DELETE FROM entity_edges WHERE from_id = ? OR to_id = ?').run(id, id);
  });

  transaction();
}

// ============================================================================
// VECTOR SEARCH
// ============================================================================

/**
 * Busqueda vectorial de entidades
 */
export function searchEntities(
  queryEmbedding: number[],
  k: number = 5,
  filters: SearchFilters = {}
): VectorSearchResult[] {
  const db = getDb();

  const paddedEmbedding = padEmbedding(queryEmbedding, 2048);
  const buffer = Buffer.from(new Float32Array(paddedEmbedding).buffer);

  const overFetchK = k * 10;

  let query = `
    SELECT
      v.entity_id,
      e.type,
      v.distance
    FROM vec_entities v
    JOIN entities e ON e.id = v.entity_id
    WHERE v.embedding MATCH ?
      AND k = ?
  `;

  const params: any[] = [buffer, overFetchK];

  if (filters.type) {
    query += ` AND e.type = ?`;
    params.push(filters.type);
  }

  if (filters.category) {
    query += ` AND e.category = ?`;
    params.push(filters.category);
  }

  // Filtro por tags (buscar en el JSON data)
  if (filters.tags && filters.tags.length > 0) {
    for (const tag of filters.tags) {
      query += ` AND e.data LIKE ?`;
      params.push(`%"${tag}"%`);
    }
  }

  // Filtro por skills que usan una tool especifica
  if (filters.usesTool) {
    query += ` AND e.type = 'skill' AND e.data LIKE ?`;
    params.push(`%"${filters.usesTool}"%`);
  }

  query += ` ORDER BY v.distance LIMIT ?`;
  params.push(k);

  const stmt = db.prepare(query);
  const results = stmt.all(...params) as any[];

  return results.map(r => ({
    entityId: r.entity_id,
    type: r.type as EntityType,
    distance: r.distance
  }));
}

// ============================================================================
// GRAPH OPERATIONS
// ============================================================================

/**
 * Añadir edge entre entidades
 */
export function addEdge(edge: EntityEdge): void {
  const db = getDb();

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO entity_edges (from_id, to_id, type, weight, metadata)
    VALUES (?, ?, ?, ?, ?)
  `);

  stmt.run(
    edge.fromId,
    edge.toId,
    edge.type,
    edge.weight || 1.0,
    edge.metadata ? JSON.stringify(edge.metadata) : null
  );
}

/**
 * Obtener edges desde una entidad
 */
export function getEdgesFrom(entityId: string, edgeTypes?: EdgeType[]): EntityEdge[] {
  const db = getDb();

  let query = 'SELECT * FROM entity_edges WHERE from_id = ?';
  const params: any[] = [entityId];

  if (edgeTypes && edgeTypes.length > 0) {
    query += ` AND type IN (${edgeTypes.map(() => '?').join(',')})`;
    params.push(...edgeTypes);
  }

  const rows = db.prepare(query).all(...params) as any[];

  return rows.map(r => ({
    fromId: r.from_id,
    toId: r.to_id,
    type: r.type as EdgeType,
    weight: r.weight,
    metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
    createdAt: r.created_at
  }));
}

/**
 * Obtener edges hacia una entidad
 */
export function getEdgesTo(entityId: string, edgeTypes?: EdgeType[]): EntityEdge[] {
  const db = getDb();

  let query = 'SELECT * FROM entity_edges WHERE to_id = ?';
  const params: any[] = [entityId];

  if (edgeTypes && edgeTypes.length > 0) {
    query += ` AND type IN (${edgeTypes.map(() => '?').join(',')})`;
    params.push(...edgeTypes);
  }

  const rows = db.prepare(query).all(...params) as any[];

  return rows.map(r => ({
    fromId: r.from_id,
    toId: r.to_id,
    type: r.type as EdgeType,
    weight: r.weight,
    metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
    createdAt: r.created_at
  }));
}

/**
 * Eliminar edge
 */
export function deleteEdge(fromId: string, toId: string, type: EdgeType): void {
  const db = getDb();
  db.prepare('DELETE FROM entity_edges WHERE from_id = ? AND to_id = ? AND type = ?')
    .run(fromId, toId, type);
}

/**
 * Obtener estadisticas del grafo
 */
export function getGraphStats() {
  const db = getDb();

  const totalEntities = db.prepare('SELECT COUNT(*) as count FROM entities').get() as { count: number };
  const totalTools = db.prepare("SELECT COUNT(*) as count FROM entities WHERE type = 'tool'").get() as { count: number };
  const totalSkills = db.prepare("SELECT COUNT(*) as count FROM entities WHERE type = 'skill'").get() as { count: number };
  const totalEdges = db.prepare('SELECT COUNT(*) as count FROM entity_edges').get() as { count: number };
  
  const edgesByType = db.prepare(`
    SELECT type, COUNT(*) as count 
    FROM entity_edges 
    GROUP BY type
  `).all() as { type: string; count: number }[];

  return {
    totalEntities: totalEntities.count,
    totalTools: totalTools.count,
    totalSkills: totalSkills.count,
    totalEdges: totalEdges.count,
    edgesByType: edgesByType.reduce((acc, row) => {
      acc[row.type] = row.count;
      return acc;
    }, {} as Record<string, number>)
  };
}

