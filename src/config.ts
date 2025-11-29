import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export interface Config {
    // OpenAI Configuration
    openai: {
        apiKey: string | undefined;
        embeddingModel: string;
    };
    
    // Ollama Configuration
    ollama: {
        url: string;
        embeddingModel: string;
    };
    
    // Embedding Service
    embeddingService: 'mock' | 'openai' | 'ollama';
    
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
    
    ollama: {
        url: process.env.OLLAMA_URL || 'http://localhost:11434',
        embeddingModel: process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text'
    },
    
    embeddingService: (process.env.EMBEDDING_SERVICE as 'mock' | 'openai' | 'ollama') || 'mock',
    
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
    
    if (config.embeddingService === 'ollama') {
        if (!config.ollama.url) {
            errors.push('OLLAMA_URL is required when using Ollama embeddings');
        }
        if (!config.ollama.embeddingModel) {
            errors.push('OLLAMA_EMBEDDING_MODEL is required when using Ollama embeddings');
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

