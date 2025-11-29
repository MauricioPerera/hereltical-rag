import { describe, it, expect } from 'vitest';
import { extractEntities, extractConceptsFromTexts } from '../src/graph/entityExtractor.js';

describe('Entity Extractor', () => {
  describe('extractEntities', () => {
    it('should extract code references in backticks', () => {
      const text = 'Use the `calculateSum` function to add numbers';
      const result = extractEntities(text);
      
      expect(result.entities.some(e => e.text === 'calculateSum')).toBe(true);
      expect(result.entities.find(e => e.text === 'calculateSum')?.type).toBe('CODE_REFERENCE');
    });

    it('should extract technologies', () => {
      const text = 'We built this with React and Python on Node.js';
      const result = extractEntities(text);
      
      expect(result.technologies).toContain('react');
      expect(result.technologies).toContain('python');
      expect(result.technologies).toContain('node.js');
    });

    it('should extract concepts', () => {
      const text = 'Machine learning with embedding and deep learning tasks';
      const result = extractEntities(text);
      
      expect(result.concepts).toContain('machine learning');
      expect(result.concepts).toContain('embedding');
      expect(result.concepts).toContain('deep learning');
    });

    it('should extract acronyms', () => {
      const text = 'The API uses HTTP and SQL databases';
      const result = extractEntities(text);
      
      const acronyms = result.entities.filter(e => e.type === 'ACRONYM');
      // HTTP and SQL are acronyms (not in TECHNOLOGIES list)
      expect(acronyms.length).toBeGreaterThan(0);
    });

    it('should extract version numbers', () => {
      const text = 'Upgrade to v2.0 or version 3.1.4';
      const result = extractEntities(text);
      
      const versions = result.entities.filter(e => e.type === 'VERSION');
      expect(versions.length).toBeGreaterThan(0);
    });

    it('should extract metrics', () => {
      const text = 'Response time improved by 50% to 100ms';
      const result = extractEntities(text);
      
      const metrics = result.entities.filter(e => e.type === 'METRIC');
      expect(metrics.length).toBeGreaterThan(0);
    });

    it('should calculate frequency for repeated entities', () => {
      const text = 'React is great. React components are reusable. React hooks simplify state.';
      const result = extractEntities(text);
      
      const react = result.entities.find(e => e.normalized === 'react');
      expect(react?.frequency).toBe(3);
    });

    it('should provide stats', () => {
      const text = 'Build a REST API with Python using Flask and PostgreSQL';
      const result = extractEntities(text);
      
      expect(result.stats.totalEntities).toBeGreaterThan(0);
      expect(result.stats.uniqueEntities).toBeGreaterThan(0);
      expect(result.stats.byType).toBeDefined();
    });
  });

  describe('extractConceptsFromTexts', () => {
    it('should combine entities from multiple texts', () => {
      const texts = [
        'Machine learning with Python',
        'Deep learning using React',
        'Clustering in Node.js'
      ];
      
      const result = extractConceptsFromTexts(texts);
      
      expect(result.concepts).toContain('machine learning');
      expect(result.concepts).toContain('deep learning');
      expect(result.concepts).toContain('clustering');
      expect(result.technologies).toContain('python');
      expect(result.technologies).toContain('react');
    });

    it('should aggregate frequency across texts', () => {
      const texts = [
        'Python is versatile',
        'Python for data science',
        'Python machine learning'
      ];
      
      const result = extractConceptsFromTexts(texts);
      const python = result.entities.find(e => e.normalized === 'python');
      
      expect(python?.frequency).toBe(3);
    });
  });

  describe('CamelCase detection', () => {
    it('should extract CamelCase identifiers', () => {
      const text = 'The UserService handles requests through DataProcessor';
      const result = extractEntities(text);
      
      const codeRefs = result.entities.filter(e => e.type === 'CODE_REFERENCE');
      expect(codeRefs.some(e => e.text === 'UserService')).toBe(true);
      expect(codeRefs.some(e => e.text === 'DataProcessor')).toBe(true);
    });
  });

  describe('snake_case detection', () => {
    it('should extract snake_case identifiers', () => {
      const text = 'Call get_user_data and process_results functions';
      const result = extractEntities(text);
      
      const codeRefs = result.entities.filter(e => e.type === 'CODE_REFERENCE');
      expect(codeRefs.some(e => e.normalized === 'get_user_data')).toBe(true);
      expect(codeRefs.some(e => e.normalized === 'process_results')).toBe(true);
    });
  });
});

