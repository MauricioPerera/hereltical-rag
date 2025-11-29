import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';

export interface SectionRow {
  node_id: string;
  doc_id: string;
  level: number;
  title: string;
  is_leaf: number; // 0 or 1
  path: string; // JSON string
  hash?: string; // Content hash for change detection
  dimensions?: number; // Actual embedding dimensions (for matryoshka support)
}

export interface SearchResult {
  node_id: string;
  doc_id: string;
  distance: number;
}

let DB_PATH = 'rag.db';

let dbInstance: Database.Database | null = null;

/**
 * Set a custom database path (useful for testing)
 * Must be called before any database operations
 */
export function setDbPath(path: string) {
  if (dbInstance) {
    throw new Error('Cannot change DB path after database is initialized. Call closeDb() first.');
  }
  DB_PATH = path;
}

/**
 * Close the database connection and reset the instance
 * Useful for cleanup in tests
 */
export function closeDb() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

export function getVectorDb() {
  if (dbInstance) return dbInstance;

  dbInstance = new Database(DB_PATH);
  sqliteVec.load(dbInstance);

  // Initialize tables
  // Added hash and dimensions columns
  // Note: vec_sections uses FLOAT[2048] to support various embedding dimensions
  // Actual dimensions are stored in sections.dimensions column
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS sections (
      rowid      INTEGER PRIMARY KEY,
      node_id    TEXT UNIQUE NOT NULL,
      doc_id     TEXT NOT NULL,
      level      INTEGER NOT NULL,
      title      TEXT,
      is_leaf    INTEGER NOT NULL,
      path       TEXT,
      hash       TEXT,
      dimensions INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS vec_sections USING vec0(
      rowid INTEGER PRIMARY KEY,
      embedding FLOAT[2048]
    );

    -- Graph: Edges table for explicit relationships
    CREATE TABLE IF NOT EXISTS edges (
      from_node_id TEXT NOT NULL,
      to_node_id   TEXT NOT NULL,
      type         TEXT NOT NULL,
      weight       REAL,
      metadata     TEXT,
      created_at   TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (from_node_id, to_node_id, type)
    );

    CREATE INDEX IF NOT EXISTS idx_edges_from ON edges(from_node_id, type);
    CREATE INDEX IF NOT EXISTS idx_edges_to ON edges(to_node_id, type);
    CREATE INDEX IF NOT EXISTS idx_edges_type ON edges(type);
  `);

  // Migration checks (simplistic for this demo)
  try {
    dbInstance.prepare('SELECT hash FROM sections LIMIT 1').get();
  } catch (e) {
    console.log('Migrating: Adding hash column to sections table...');
    dbInstance.exec('ALTER TABLE sections ADD COLUMN hash TEXT');
  }

  try {
    dbInstance.prepare('SELECT dimensions FROM sections LIMIT 1').get();
  } catch (e) {
    console.log('Migrating: Adding dimensions column to sections table...');
    dbInstance.exec('ALTER TABLE sections ADD COLUMN dimensions INTEGER');
  }

  return dbInstance;
}

export function upsertSection(
  meta: SectionRow,
  embedding: number[]
) {
  const db = getVectorDb();

  // Store actual dimensions
  const actualDimensions = embedding.length;
  const metaWithDims = { ...meta, dimensions: actualDimensions };

  const insertMeta = db.prepare(`
    INSERT OR REPLACE INTO sections (node_id, doc_id, level, title, is_leaf, path, hash, dimensions)
    VALUES (@node_id, @doc_id, @level, @title, @is_leaf, @path, @hash, @dimensions)
  `);

  const insertVec = db.prepare(`
    INSERT OR REPLACE INTO vec_sections(rowid, embedding)
    VALUES (?, ?)
  `);

  const transaction = db.transaction(() => {
    const info = insertMeta.run(metaWithDims);
    const rowid = info.lastInsertRowid;

    // Pad embedding to 2048 dimensions if needed (sqlite-vec table is FLOAT[2048])
    const paddedEmbedding = padEmbedding(embedding, 2048);
    const buffer = Buffer.from(new Float32Array(paddedEmbedding).buffer);

    // Explicitly pass rowid as BigInt to satisfy sqlite-vec if it requires it
    insertVec.run(BigInt(rowid), buffer);
  });

  transaction();
}

/**
 * Pad embedding to target dimensions with zeros
 * @param embedding - Original embedding
 * @param targetDims - Target dimensions
 * @returns Padded embedding
 */
function padEmbedding(embedding: number[], targetDims: number): number[] {
  if (embedding.length >= targetDims) {
    return embedding.slice(0, targetDims);
  }
  
  // Pad with zeros
  const padded = new Array(targetDims).fill(0);
  for (let i = 0; i < embedding.length; i++) {
    padded[i] = embedding[i];
  }
  
  return padded;
}

export function getSectionMeta(nodeId: string): SectionRow | undefined {
  const db = getVectorDb();
  return db.prepare('SELECT * FROM sections WHERE node_id = ?').get(nodeId) as SectionRow | undefined;
}

export function deleteSection(nodeId: string) {
  const db = getVectorDb();
  const getRowId = db.prepare('SELECT rowid FROM sections WHERE node_id = ?').pluck();
  const deleteMeta = db.prepare('DELETE FROM sections WHERE node_id = ?');
  const deleteVec = db.prepare('DELETE FROM vec_sections WHERE rowid = ?');

  const transaction = db.transaction(() => {
    const rowid = getRowId.get(nodeId);
    if (rowid) {
      deleteVec.run(rowid);
      deleteMeta.run(nodeId);
    }
  });

  transaction();
}

export function getDocNodeIds(docId: string): string[] {
  const db = getVectorDb();
  const rows = db.prepare('SELECT node_id FROM sections WHERE doc_id = ?').all(docId) as { node_id: string }[];
  return rows.map(r => r.node_id);
}

export interface SearchFilters {
  doc_id?: string;
  level?: number;
  is_leaf?: number;
}

export function searchKnn(queryEmbedding: number[], k: number = 5, filters: SearchFilters = {}): SearchResult[] {
  const db = getVectorDb();

  // Pad query embedding to match table dimensions (2048)
  const paddedEmbedding = padEmbedding(queryEmbedding, 2048);
  const buffer = Buffer.from(new Float32Array(paddedEmbedding).buffer);

  // Over-fetch from vector index to allow for filtering
  // If we want k results after filtering, we need to ask the vector index for more candidates.
  const overFetchK = k * 10;

  let query = `
    SELECT
      s.node_id,
      s.doc_id,
      v.distance
    FROM vec_sections v
    JOIN sections s ON s.rowid = v.rowid
    WHERE v.embedding MATCH ?
      AND k = ?
  `;

  const params: any[] = [buffer, overFetchK];

  if (filters.doc_id) {
    query += ` AND s.doc_id = ?`;
    params.push(filters.doc_id);
  }

  if (filters.level !== undefined) {
    query += ` AND s.level = ?`;
    params.push(filters.level);
  }

  if (filters.is_leaf !== undefined) {
    query += ` AND s.is_leaf = ?`;
    params.push(filters.is_leaf);
  }

  query += ` ORDER BY v.distance LIMIT ?`;
  params.push(k);

  const stmt = db.prepare(query);
  return stmt.all(...params) as SearchResult[];
}
