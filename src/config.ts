import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export interface Config {
    // OpenAI Configuration
    openai: {
        apiKey: string | undefined;
        embeddingModel: string;
    };
    
    // Embedding Service
    embeddingService: 'mock' | 'openai';
    
    // API Configuration
    api: {
        port: number;
        host: string;
    };
    
    // Database Paths
    db: {
        vectorPath: string;
        jsonPath: string;
    };
}

export const config: Config = {
    openai: {
        apiKey: process.env.OPENAI_API_KEY,
        embeddingModel: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small'
    },
    
    embeddingService: (process.env.EMBEDDING_SERVICE as 'mock' | 'openai') || 'mock',
    
    api: {
        port: parseInt(process.env.API_PORT || '3000', 10),
        host: process.env.API_HOST || 'localhost'
    },
    
    db: {
        vectorPath: process.env.DB_PATH || 'rag.db',
        jsonPath: process.env.JSON_PATH || 'documents.json'
    }
};

// Validation
export function validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (config.embeddingService === 'openai') {
        if (!config.openai.apiKey) {
            errors.push('OPENAI_API_KEY is required when using OpenAI embeddings');
        }
    }
    
    if (config.api.port < 1 || config.api.port > 65535) {
        errors.push('API_PORT must be between 1 and 65535');
    }
    
    return {
        valid: errors.length === 0,
        errors
    };
}

