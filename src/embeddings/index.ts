import { config } from '../config.js';
import { generateMockEmbedding } from './mockEmbeddings.js';
import { generateOpenAIEmbedding, generateOpenAIEmbeddingsBatch } from './openaiEmbeddings.js';

/**
 * Generate embedding for a single text using the configured service
 * @param text - Text to embed
 * @returns Embedding vector
 */
export async function embed(text: string): Promise<number[]> {
    switch (config.embeddingService) {
        case 'openai':
            return generateOpenAIEmbedding(text);
        case 'mock':
        default:
            return generateMockEmbedding(text);
    }
}

/**
 * Generate embeddings for multiple texts in batch
 * Note: Mock service processes one at a time, OpenAI can batch process
 * @param texts - Array of texts to embed
 * @returns Array of embedding vectors
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
    switch (config.embeddingService) {
        case 'openai':
            return generateOpenAIEmbeddingsBatch(texts);
        case 'mock':
        default:
            // Mock service doesn't have batch optimization, process sequentially
            return Promise.all(texts.map(text => generateMockEmbedding(text)));
    }
}

/**
 * Get information about the current embedding service
 */
export function getEmbeddingServiceInfo() {
    return {
        service: config.embeddingService,
        model: config.embeddingService === 'openai' ? config.openai.embeddingModel : 'mock-deterministic',
        dimensions: 1536
    };
}

