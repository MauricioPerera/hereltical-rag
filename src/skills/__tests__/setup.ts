/**
 * Test Setup Utilities for Skill Bank
 */

import { setDbPath, closeDb } from '../store/unifiedStore.js';
import crypto from 'crypto';

/**
 * Setup test database (in-memory)
 */
export function setupTestDb(): void {
  // Use :memory: for fast, isolated tests
  setDbPath(':memory:');
}

/**
 * Clean database and close connection
 */
export function cleanDb(): void {
  closeDb();
}

/**
 * Mock embedding service - deterministic for tests
 * Genera un embedding basado en el hash del texto
 */
export async function mockEmbed(text: string): Promise<number[]> {
  // Hash del texto para determinismo
  const hash = crypto.createHash('sha256').update(text).digest();
  
  // Generar 768 dimensiones basadas en el hash
  const embedding: number[] = [];
  for (let i = 0; i < 768; i++) {
    const value = hash[i % hash.length] / 255;
    embedding.push(Math.sin(value * Math.PI * 2 + i));
  }
  
  return embedding;
}

/**
 * Generate similar embedding (for testing similarity)
 */
export async function mockEmbedSimilar(baseText: string, variation: number = 0.1): Promise<number[]> {
  const base = await mockEmbed(baseText);
  return base.map(v => v + (Math.random() - 0.5) * variation);
}

/**
 * Generate random embedding (for testing dissimilarity)
 */
export function mockEmbedRandom(): number[] {
  return Array(768).fill(0).map(() => (Math.random() - 0.5) * 2);
}

