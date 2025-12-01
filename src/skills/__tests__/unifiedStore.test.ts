/**
 * UnifiedStore Tests - CRUD, Vector Search, Graph Operations
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupTestDb, cleanDb, mockEmbed, mockEmbedRandom } from './setup.js';
import { mockTools, getMockTool } from './fixtures/tools.js';
import { mockSkills, getMockSkill } from './fixtures/skills.js';
import {
  upsertTool,
  upsertSkill,
  getTool,
  getSkill,
  getEntity,
  listEntities,
  deleteEntity,
  searchEntities,
  addEdge,
  getEdgesFrom,
  getEdgesTo,
  deleteEdge,
  getGraphStats
} from '../store/unifiedStore.js';

describe('UnifiedStore', () => {
  beforeEach(() => {
    setupTestDb();
  });

  afterEach(() => {
    cleanDb();
  });

  // ============================================================================
  // CRUD OPERATIONS (8 tests)
  // ============================================================================

  describe('CRUD Operations', () => {
    it('should upsert tool correctly', async () => {
      const tool = mockTools[0];
      const embedding = await mockEmbed(tool.name);

      upsertTool(tool, embedding);

      const retrieved = getTool(tool.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(tool.id);
      expect(retrieved?.name).toBe(tool.name);
      expect(retrieved?.category).toBe(tool.category);
    });

    it('should upsert skill correctly', async () => {
      const skill = mockSkills[0];
      const embedding = await mockEmbed(skill.name);

      upsertSkill(skill, embedding);

      const retrieved = getSkill(skill.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(skill.id);
      expect(retrieved?.name).toBe(skill.name);
      expect(retrieved?.overview).toBe(skill.overview);
    });

    it('should get tool by ID', async () => {
      const tool = mockTools[0];
      const embedding = await mockEmbed(tool.name);
      upsertTool(tool, embedding);

      const result = getTool(tool.id);
      
      expect(result).not.toBeNull();
      expect(result?.id).toBe(tool.id);
      expect(result?.type).toBe('tool');
    });

    it('should get skill by ID', async () => {
      const skill = mockSkills[0];
      const embedding = await mockEmbed(skill.name);
      upsertSkill(skill, embedding);

      const result = getSkill(skill.id);
      
      expect(result).not.toBeNull();
      expect(result?.id).toBe(skill.id);
      expect(result?.type).toBe('skill');
    });

    it('should list all tools', async () => {
      // Register 3 tools
      for (let i = 0; i < 3; i++) {
        const tool = mockTools[i];
        const embedding = await mockEmbed(tool.name);
        upsertTool(tool, embedding);
      }

      const entities = listEntities('tool');
      
      expect(entities).toHaveLength(3);
      expect(entities.every(e => e.type === 'tool')).toBe(true);
    });

    it('should list all skills', async () => {
      // Register 3 skills
      for (let i = 0; i < 3; i++) {
        const skill = mockSkills[i];
        const embedding = await mockEmbed(skill.name);
        upsertSkill(skill, embedding);
      }

      const entities = listEntities('skill');
      
      expect(entities).toHaveLength(3);
      expect(entities.every(e => e.type === 'skill')).toBe(true);
    });

    it('should delete tool and associated edges', async () => {
      const tool = mockTools[0];
      const embedding = await mockEmbed(tool.name);
      upsertTool(tool, embedding);

      // Add an edge
      addEdge({
        fromId: tool.id,
        toId: 'some_skill',
        type: 'ENABLES'
      });

      // Delete tool
      deleteEntity(tool.id);

      // Verify tool deleted
      expect(getTool(tool.id)).toBeNull();

      // Verify edges deleted
      const edges = getEdgesFrom(tool.id);
      expect(edges).toHaveLength(0);
    });

    it('should delete skill and associated edges', async () => {
      const skill = mockSkills[0];
      const embedding = await mockEmbed(skill.name);
      upsertSkill(skill, embedding);

      // Edges should be auto-created from usesTools
      const edgesBefore = getEdgesFrom(skill.id);
      expect(edgesBefore.length).toBeGreaterThan(0);

      // Delete skill
      deleteEntity(skill.id);

      // Verify skill deleted
      expect(getSkill(skill.id)).toBeNull();

      // Verify edges deleted
      const edgesAfter = getEdgesFrom(skill.id);
      expect(edgesAfter).toHaveLength(0);
    });
  });

  // ============================================================================
  // VECTOR SEARCH (8 tests)
  // ============================================================================

  describe('Vector Search', () => {
    it('should search tools by embedding', async () => {
      // Register tools
      for (const tool of mockTools) {
        const embedding = await mockEmbed(tool.name);
        upsertTool(tool, embedding);
      }

      // Search
      const queryEmbedding = await mockEmbed('HTTP Request');
      const results = searchEntities(queryEmbedding, 3, { type: 'tool' });

      expect(results.length).toBeGreaterThan(0);
      expect(results.every(r => r.type === 'tool')).toBe(true);
      // El primero debería ser el más similar (http_request)
      expect(results[0].entityId).toBe('http_request');
    });

    it('should search skills by embedding', async () => {
      // Register skills
      for (const skill of mockSkills) {
        const embedding = await mockEmbed(skill.name);
        upsertSkill(skill, embedding);
      }

      // Search
      const queryEmbedding = await mockEmbed('Stripe payment');
      const results = searchEntities(queryEmbedding, 3, { type: 'skill' });

      expect(results.length).toBeGreaterThan(0);
      expect(results.every(r => r.type === 'skill')).toBe(true);
      // Stripe skill debería aparecer
      expect(results.some(r => r.entityId === 'stripe_api_handler')).toBe(true);
    });

    it('should filter by type (tool)', async () => {
      // Register both tools and skills
      const tool = mockTools[0];
      const skill = mockSkills[0];
      
      upsertTool(tool, await mockEmbed(tool.name));
      upsertSkill(skill, await mockEmbed(skill.name));

      // Search only tools
      const queryEmbedding = mockEmbedRandom();
      const results = searchEntities(queryEmbedding, 10, { type: 'tool' });

      expect(results.every(r => r.type === 'tool')).toBe(true);
    });

    it('should filter by type (skill)', async () => {
      // Register both tools and skills
      const tool = mockTools[0];
      const skill = mockSkills[0];
      
      upsertTool(tool, await mockEmbed(tool.name));
      upsertSkill(skill, await mockEmbed(skill.name));

      // Search only skills
      const queryEmbedding = mockEmbedRandom();
      const results = searchEntities(queryEmbedding, 10, { type: 'skill' });

      expect(results.every(r => r.type === 'skill')).toBe(true);
    });

    it('should filter by category', async () => {
      // Register tools with different categories
      for (const tool of mockTools) {
        const embedding = await mockEmbed(tool.name);
        upsertTool(tool, embedding);
      }

      // Search only network category
      const queryEmbedding = mockEmbedRandom();
      const results = searchEntities(queryEmbedding, 10, { category: 'network' });

      expect(results.length).toBeGreaterThan(0);
      
      // Verify all results are network category
      for (const result of results) {
        const tool = getTool(result.entityId);
        expect(tool?.category).toBe('network');
      }
    });

    it('should filter by tags', async () => {
      // Create tool with tags
      const tool = {
        ...mockTools[0],
        tags: ['api', 'external']
      };
      
      upsertTool(tool, await mockEmbed(tool.name));

      // Search with tag filter
      const queryEmbedding = mockEmbedRandom();
      const results = searchEntities(queryEmbedding, 10, { tags: ['api'] });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].entityId).toBe(tool.id);
    });

    it('should filter by usesTool', async () => {
      // Register tool and skill that uses it
      const tool = mockTools[0]; // http_request
      const skill = mockSkills[0]; // Uses http_request
      
      upsertTool(tool, await mockEmbed(tool.name));
      upsertSkill(skill, await mockEmbed(skill.name));

      // Search skills that use http_request
      const queryEmbedding = mockEmbedRandom();
      const results = searchEntities(queryEmbedding, 10, { usesTool: 'http_request' });

      expect(results.length).toBeGreaterThan(0);
      expect(results.every(r => r.type === 'skill')).toBe(true);
      
      // Verify all results use http_request
      for (const result of results) {
        const skill = getSkill(result.entityId);
        expect(skill?.usesTools).toContain('http_request');
      }
    });

    it('should return top-k results', async () => {
      // Register 5 tools
      for (let i = 0; i < 5; i++) {
        const tool = mockTools[i];
        const embedding = await mockEmbed(tool.name);
        upsertTool(tool, embedding);
      }

      // Request top 3
      const queryEmbedding = mockEmbedRandom();
      const results = searchEntities(queryEmbedding, 3);

      expect(results.length).toBeLessThanOrEqual(3);
    });

    it('should return scores in decreasing order', async () => {
      // Register multiple tools
      for (const tool of mockTools) {
        const embedding = await mockEmbed(tool.name);
        upsertTool(tool, embedding);
      }

      // Search
      const queryEmbedding = await mockEmbed('Database');
      const results = searchEntities(queryEmbedding, 5);

      // Verify scores are decreasing (distances increasing)
      for (let i = 1; i < results.length; i++) {
        expect(results[i].distance).toBeGreaterThanOrEqual(results[i - 1].distance);
      }
    });
  });

  // ============================================================================
  // GRAPH OPERATIONS (10 tests)
  // ============================================================================

  describe('Graph Operations', () => {
    it('should add edge between entities', () => {
      addEdge({
        fromId: 'entity_a',
        toId: 'entity_b',
        type: 'USES',
        weight: 1.0
      });

      const edges = getEdgesFrom('entity_a');
      
      expect(edges).toHaveLength(1);
      expect(edges[0].fromId).toBe('entity_a');
      expect(edges[0].toId).toBe('entity_b');
      expect(edges[0].type).toBe('USES');
    });

    it('should get edges from entity', () => {
      // Add multiple edges
      addEdge({ fromId: 'a', toId: 'b', type: 'USES' });
      addEdge({ fromId: 'a', toId: 'c', type: 'ENABLES' });
      addEdge({ fromId: 'x', toId: 'y', type: 'USES' });

      const edges = getEdgesFrom('a');
      
      expect(edges).toHaveLength(2);
      expect(edges.every(e => e.fromId === 'a')).toBe(true);
    });

    it('should get edges to entity', () => {
      // Add multiple edges
      addEdge({ fromId: 'a', toId: 'target', type: 'USES' });
      addEdge({ fromId: 'b', toId: 'target', type: 'ENABLES' });
      addEdge({ fromId: 'x', toId: 'y', type: 'USES' });

      const edges = getEdgesTo('target');
      
      expect(edges).toHaveLength(2);
      expect(edges.every(e => e.toId === 'target')).toBe(true);
    });

    it('should filter edges by type', () => {
      // Add edges of different types
      addEdge({ fromId: 'a', toId: 'b', type: 'USES' });
      addEdge({ fromId: 'a', toId: 'c', type: 'ENABLES' });
      addEdge({ fromId: 'a', toId: 'd', type: 'COMPLEMENTS' });

      const usesEdges = getEdgesFrom('a', ['USES']);
      
      expect(usesEdges).toHaveLength(1);
      expect(usesEdges[0].type).toBe('USES');
    });

    it('should delete edge', () => {
      addEdge({ fromId: 'a', toId: 'b', type: 'USES' });
      
      let edges = getEdgesFrom('a');
      expect(edges).toHaveLength(1);

      deleteEdge('a', 'b', 'USES');
      
      edges = getEdgesFrom('a');
      expect(edges).toHaveLength(0);
    });

    it('should auto-create USES edge when registering skill', async () => {
      // Register tool first
      const tool = mockTools[0];
      upsertTool(tool, await mockEmbed(tool.name));

      // Register skill that uses this tool
      const skill = mockSkills[0]; // Uses http_request
      upsertSkill(skill, await mockEmbed(skill.name));

      // Check USES edge was created
      const edges = getEdgesFrom(skill.id, ['USES']);
      
      expect(edges.length).toBeGreaterThan(0);
      expect(edges.some(e => e.toId === 'http_request')).toBe(true);
    });

    it('should auto-create ENABLES edge when registering skill', async () => {
      // Register tool first
      const tool = mockTools[0];
      upsertTool(tool, await mockEmbed(tool.name));

      // Register skill that uses this tool
      const skill = mockSkills[0]; // Uses http_request
      upsertSkill(skill, await mockEmbed(skill.name));

      // Check ENABLES edge was created (tool → skill)
      const edges = getEdgesFrom(tool.id, ['ENABLES']);
      
      expect(edges.length).toBeGreaterThan(0);
      expect(edges.some(e => e.toId === skill.id)).toBe(true);
    });

    it('should return correct graph stats', async () => {
      // Register entities
      upsertTool(mockTools[0], await mockEmbed(mockTools[0].name));
      upsertTool(mockTools[1], await mockEmbed(mockTools[1].name));
      upsertSkill(mockSkills[0], await mockEmbed(mockSkills[0].name));

      // Add manual edge
      addEdge({ fromId: mockTools[0].id, toId: mockTools[1].id, type: 'COMPLEMENTS' });

      const stats = getGraphStats();

      expect(stats.totalEntities).toBe(3);
      expect(stats.totalTools).toBe(2);
      expect(stats.totalSkills).toBe(1);
      expect(stats.totalEdges).toBeGreaterThan(0);
      expect(stats.edgesByType).toBeDefined();
    });

    it('should store edges with metadata', () => {
      const metadata = { reason: 'test', confidence: 0.9 };
      
      addEdge({
        fromId: 'a',
        toId: 'b',
        type: 'USES',
        metadata
      });

      const edges = getEdgesFrom('a');
      
      expect(edges[0].metadata).toBeDefined();
      expect(edges[0].metadata?.reason).toBe('test');
      expect(edges[0].metadata?.confidence).toBe(0.9);
    });

    it('should store edges with custom weight', () => {
      addEdge({
        fromId: 'a',
        toId: 'b',
        type: 'USES',
        weight: 0.75
      });

      const edges = getEdgesFrom('a');
      
      expect(edges[0].weight).toBe(0.75);
    });
  });

  // ============================================================================
  // CHANGE DETECTION (4 tests)
  // ============================================================================

  describe('Change Detection', () => {
    it('should calculate hash correctly', async () => {
      const tool = mockTools[0];
      const embedding = await mockEmbed(tool.name);

      upsertTool(tool, embedding);

      const entity = getEntity(tool.id);
      expect(entity?.hash).toBeDefined();
      expect(entity?.hash).toHaveLength(64); // SHA-256 hex = 64 chars
    });

    it('should update only if content changed', async () => {
      const tool = mockTools[0];
      const embedding = await mockEmbed(tool.name);

      // First insert
      upsertTool(tool, embedding);
      const entity1 = getEntity(tool.id);

      // Re-insert same tool (content unchanged)
      upsertTool(tool, embedding);
      const entity2 = getEntity(tool.id);

      // Hash should be same (content unchanged)
      expect(entity2?.hash).toBe(entity1?.hash);
      
      // Entity should exist
      expect(entity2).toBeDefined();
    });

    it('should detect content changes via hash', async () => {
      const tool = mockTools[0];
      const embedding = await mockEmbed(tool.name);

      // First insert
      upsertTool(tool, embedding);
      const entity1 = getEntity(tool.id);

      // Modify tool
      const modifiedTool = { ...tool, description: 'Modified description' };
      upsertTool(modifiedTool, embedding);
      const entity2 = getEntity(tool.id);

      // Hashes should be different
      expect(entity2?.hash).not.toBe(entity1?.hash);
    });

    it('should update updated_at on changes', async () => {
      const tool = mockTools[0];
      const embedding = await mockEmbed(tool.name);

      // First insert
      upsertTool(tool, embedding);
      const entity1 = getEntity(tool.id);

      // Modify and re-insert
      const modifiedTool = { ...tool, description: 'Changed description!' };
      upsertTool(modifiedTool, embedding);
      const entity2 = getEntity(tool.id);

      // Description should be updated
      const retrievedTool = getTool(tool.id);
      expect(retrievedTool?.description).toBe('Changed description!');
      
      // Entity should exist with updated timestamp
      expect(entity2).toBeDefined();
      expect(entity2?.updatedAt).toBeDefined();
    });
  });
});

