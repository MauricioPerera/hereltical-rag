/**
 * In-memory Rate Limiter
 * 
 * Simple rate limiting without Redis dependency.
 * For production with multiple instances, use Redis-based solution.
 */

import { Request, Response, NextFunction } from 'express';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Max requests per window
  message?: string;      // Error message
  keyGenerator?: (req: Request) => string;  // Custom key generator
  skip?: (req: Request) => boolean;         // Skip certain requests
}

// In-memory store (cleared on restart)
const store = new Map<string, RateLimitEntry>();

// Cleanup old entries every minute
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.resetTime < now) {
      store.delete(key);
    }
  }
}, 60000);

/**
 * Default key generator - uses IP address
 */
function defaultKeyGenerator(req: Request): string {
  return req.ip || 
         req.headers['x-forwarded-for']?.toString().split(',')[0] || 
         req.socket.remoteAddress || 
         'unknown';
}

/**
 * Create rate limiter middleware
 */
export function rateLimit(config: RateLimitConfig) {
  const {
    windowMs,
    maxRequests,
    message = 'Too many requests, please try again later.',
    keyGenerator = defaultKeyGenerator,
    skip
  } = config;

  return (req: Request, res: Response, next: NextFunction) => {
    // Skip if configured
    if (skip && skip(req)) {
      return next();
    }

    const key = keyGenerator(req);
    const now = Date.now();
    
    let entry = store.get(key);
    
    if (!entry || entry.resetTime < now) {
      // Create new entry
      entry = {
        count: 1,
        resetTime: now + windowMs
      };
      store.set(key, entry);
    } else {
      entry.count++;
    }

    // Set rate limit headers
    const remaining = Math.max(0, maxRequests - entry.count);
    const resetSeconds = Math.ceil((entry.resetTime - now) / 1000);
    
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', resetSeconds);

    if (entry.count > maxRequests) {
      res.setHeader('Retry-After', resetSeconds);
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message,
        retryAfter: resetSeconds
      });
    }

    next();
  };
}

/**
 * Preset configurations
 */
export const rateLimitPresets = {
  // Standard API rate limit
  standard: () => rateLimit({
    windowMs: 60 * 1000,  // 1 minute
    maxRequests: 60,      // 60 requests per minute
    message: 'Rate limit exceeded. Please wait before making more requests.'
  }),

  // Strict rate limit for expensive operations
  strict: () => rateLimit({
    windowMs: 60 * 1000,  // 1 minute
    maxRequests: 10,      // 10 requests per minute
    message: 'This endpoint has strict rate limits. Please wait.'
  }),

  // Relaxed for health checks
  relaxed: () => rateLimit({
    windowMs: 60 * 1000,
    maxRequests: 300,
    skip: (req) => req.path === '/health'
  }),

  // Per-endpoint rate limiting
  perEndpoint: (maxRequests: number) => rateLimit({
    windowMs: 60 * 1000,
    maxRequests,
    keyGenerator: (req) => `${defaultKeyGenerator(req)}:${req.path}`
  })
};

/**
 * Get current rate limit stats (for monitoring)
 */
export function getRateLimitStats(): {
  activeKeys: number;
  totalRequests: number;
} {
  let totalRequests = 0;
  for (const entry of store.values()) {
    totalRequests += entry.count;
  }
  
  return {
    activeKeys: store.size,
    totalRequests
  };
}

