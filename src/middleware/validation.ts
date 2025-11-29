/**
 * Request Validation Middleware
 * 
 * Input validation and sanitization for API endpoints.
 */

import { Request, Response, NextFunction } from 'express';

export interface ValidationRule {
  field: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required?: boolean;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  enum?: any[];
  custom?: (value: any) => boolean | string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  sanitized: Record<string, any>;
}

/**
 * Validate a value against rules
 */
function validateValue(value: any, rule: ValidationRule): string | null {
  const { field, type, required, min, max, minLength, maxLength, pattern, enum: enumValues, custom } = rule;

  // Check required
  if (required && (value === undefined || value === null || value === '')) {
    return `${field} is required`;
  }

  // Skip further validation if value is empty and not required
  if (value === undefined || value === null) {
    return null;
  }

  // Type check
  const actualType = Array.isArray(value) ? 'array' : typeof value;
  if (actualType !== type && !(type === 'number' && !isNaN(Number(value)))) {
    return `${field} must be a ${type}`;
  }

  // Number validations
  if (type === 'number') {
    const numValue = Number(value);
    if (min !== undefined && numValue < min) {
      return `${field} must be at least ${min}`;
    }
    if (max !== undefined && numValue > max) {
      return `${field} must be at most ${max}`;
    }
  }

  // String validations
  if (type === 'string') {
    if (minLength !== undefined && value.length < minLength) {
      return `${field} must be at least ${minLength} characters`;
    }
    if (maxLength !== undefined && value.length > maxLength) {
      return `${field} must be at most ${maxLength} characters`;
    }
    if (pattern && !pattern.test(value)) {
      return `${field} has invalid format`;
    }
  }

  // Array validations
  if (type === 'array') {
    if (minLength !== undefined && value.length < minLength) {
      return `${field} must have at least ${minLength} items`;
    }
    if (maxLength !== undefined && value.length > maxLength) {
      return `${field} must have at most ${maxLength} items`;
    }
  }

  // Enum validation
  if (enumValues && !enumValues.includes(value)) {
    return `${field} must be one of: ${enumValues.join(', ')}`;
  }

  // Custom validation
  if (custom) {
    const result = custom(value);
    if (typeof result === 'string') {
      return result;
    }
    if (result === false) {
      return `${field} is invalid`;
    }
  }

  return null;
}

/**
 * Create validation middleware for body
 */
export function validateBody(rules: ValidationRule[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors: string[] = [];
    const sanitized: Record<string, any> = {};

    for (const rule of rules) {
      const value = req.body[rule.field];
      const error = validateValue(value, rule);
      
      if (error) {
        errors.push(error);
      } else if (value !== undefined) {
        // Sanitize/coerce value
        if (rule.type === 'number' && typeof value === 'string') {
          sanitized[rule.field] = Number(value);
        } else if (rule.type === 'boolean' && typeof value === 'string') {
          sanitized[rule.field] = value === 'true';
        } else {
          sanitized[rule.field] = value;
        }
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors
      });
    }

    // Attach sanitized values
    req.body = { ...req.body, ...sanitized };
    next();
  };
}

/**
 * Create validation middleware for query params
 */
export function validateQuery(rules: ValidationRule[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors: string[] = [];

    for (const rule of rules) {
      const value = req.query[rule.field];
      const error = validateValue(value, rule);
      
      if (error) {
        errors.push(error);
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors
      });
    }

    next();
  };
}

/**
 * Common validation schemas
 */
export const schemas = {
  // Query endpoint
  query: [
    { field: 'query', type: 'string', required: true, minLength: 1, maxLength: 1000 },
    { field: 'k', type: 'number', min: 1, max: 50 },
    { field: 'useGraph', type: 'boolean' },
    { field: 'rerank', type: 'boolean' },
    { field: 'maxHops', type: 'number', min: 1, max: 5 }
  ] as ValidationRule[],

  // Index endpoint
  index: [
    { field: 'content', type: 'string', required: true, minLength: 1 },
    { field: 'docId', type: 'string', maxLength: 100 }
  ] as ValidationRule[],

  // Entity extraction
  extractEntities: [
    { field: 'text', type: 'string', required: true, minLength: 1, maxLength: 50000 }
  ] as ValidationRule[],

  // Graph expansion
  graphExpand: [
    { field: 'seeds', type: 'array', required: true, minLength: 1 },
    { field: 'maxHops', type: 'number', min: 1, max: 5 },
    { field: 'maxNodes', type: 'number', min: 1, max: 100 }
  ] as ValidationRule[]
};

/**
 * Sanitize string to prevent XSS
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Sanitize object recursively
 */
export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
  const sanitized: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(v => 
        typeof v === 'string' ? sanitizeString(v) : 
        typeof v === 'object' ? sanitizeObject(v) : v
      );
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized as T;
}

