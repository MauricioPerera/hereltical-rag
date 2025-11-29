/**
 * Simple API Key Authentication
 * 
 * Lightweight auth without database dependencies.
 * API keys are configured via environment variables.
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export interface AuthConfig {
  enabled: boolean;
  apiKeys: Set<string>;
  headerName: string;
  skipPaths: string[];
}

// Default configuration
let authConfig: AuthConfig = {
  enabled: false,
  apiKeys: new Set(),
  headerName: 'x-api-key',
  skipPaths: ['/health', '/']
};

/**
 * Initialize auth with API keys from environment
 */
export function initAuth(options?: Partial<AuthConfig>) {
  // Load API keys from environment
  const envKeys = process.env.API_KEYS?.split(',').map(k => k.trim()).filter(Boolean) || [];
  
  authConfig = {
    enabled: process.env.AUTH_ENABLED === 'true' || envKeys.length > 0,
    apiKeys: new Set(envKeys),
    headerName: process.env.AUTH_HEADER || 'x-api-key',
    skipPaths: ['/health', '/', '/index.html'],
    ...options
  };

  if (authConfig.enabled) {
    console.log(`🔐 Authentication enabled with ${authConfig.apiKeys.size} API key(s)`);
  } else {
    console.log('🔓 Authentication disabled (no API_KEYS configured)');
  }
}

/**
 * Generate a new API key
 */
export function generateApiKey(): string {
  return `hrag_${crypto.randomBytes(24).toString('hex')}`;
}

/**
 * Add an API key at runtime
 */
export function addApiKey(key: string): void {
  authConfig.apiKeys.add(key);
}

/**
 * Remove an API key
 */
export function removeApiKey(key: string): boolean {
  return authConfig.apiKeys.delete(key);
}

/**
 * Check if a key is valid
 */
export function isValidKey(key: string): boolean {
  return authConfig.apiKeys.has(key);
}

/**
 * Authentication middleware
 */
export function authenticate(req: Request, res: Response, next: NextFunction) {
  // Skip if auth is disabled
  if (!authConfig.enabled) {
    return next();
  }

  // Skip configured paths
  if (authConfig.skipPaths.some(p => req.path === p || req.path.startsWith(p))) {
    return next();
  }

  // Skip static files
  if (req.path.match(/\.(html|css|js|ico|png|jpg|svg)$/)) {
    return next();
  }

  // Get API key from header or query
  const apiKey = 
    req.headers[authConfig.headerName] as string ||
    req.headers['authorization']?.replace('Bearer ', '') ||
    req.query.api_key as string;

  if (!apiKey) {
    return res.status(401).json({
      error: 'Authentication required',
      message: `Please provide an API key via '${authConfig.headerName}' header`
    });
  }

  if (!isValidKey(apiKey)) {
    return res.status(403).json({
      error: 'Invalid API key',
      message: 'The provided API key is not valid'
    });
  }

  // Add user info to request
  (req as any).apiKey = apiKey;
  (req as any).authenticated = true;

  next();
}

/**
 * Optional auth - allows unauthenticated but marks the request
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const apiKey = 
    req.headers[authConfig.headerName] as string ||
    req.headers['authorization']?.replace('Bearer ', '');

  if (apiKey && isValidKey(apiKey)) {
    (req as any).apiKey = apiKey;
    (req as any).authenticated = true;
  } else {
    (req as any).authenticated = false;
  }

  next();
}

/**
 * Require specific role (for future use)
 */
export function requireRole(role: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    // For now, all authenticated users have all roles
    // Extend this for role-based access control
    if (!(req as any).authenticated) {
      return res.status(401).json({
        error: 'Authentication required'
      });
    }
    next();
  };
}

/**
 * Get auth status
 */
export function getAuthStatus(): {
  enabled: boolean;
  keyCount: number;
} {
  return {
    enabled: authConfig.enabled,
    keyCount: authConfig.apiKeys.size
  };
}

