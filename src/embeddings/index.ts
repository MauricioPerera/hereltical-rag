import { config } from '../config.js';
import { generateMockEmbedding } from './mockEmbeddings.js';
import { generateOpenAIEmbedding, generateOpenAIEmbeddingsBatch } from './openaiEmbeddings.js';
import { generateOllamaEmbedding, generateOllamaEmbeddingsBatch } from './ollamaEmbeddings.js';

/**
 * Generate embedding for a single text using the configured service
 * @param text - Text to embed
 * @returns Embedding vector
 */
export async function embed(text: string): Promise<number[]> {
    switch (config.embeddingService) {
        case 'openai':
            return generateOpenAIEmbedding(text);
        case 'ollama':
            return generateOllamaEmbedding(text);
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
        case 'ollama':
            return generateOllamaEmbeddingsBatch(texts);
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
    let model: string;
    let dimensions: number;

    switch (config.embeddingService) {
        case 'openai':
            model = config.openai.embeddingModel;
            dimensions = 1536; // OpenAI embedding dimensions
            break;
        case 'ollama':
            model = config.ollama.embeddingModel;
            // Common Ollama embedding models and their dimensions
            if (model.includes('nomic-embed-text')) {
                dimensions = 768;
            } else if (model.includes('mxbai-embed-large')) {
                dimensions = 1024;
            } else if (model.includes('all-minilm')) {
                dimensions = 384;
            } else {
                dimensions = 768; // Default for unknown models
            }
            break;
        case 'mock':
        default:
            model = 'mock-deterministic';
            dimensions = 1536;
            break;
    }

    return {
        service: config.embeddingService,
        model,
        dimensions,
        url: config.embeddingService === 'ollama' ? config.ollama.url : undefined
    };
}

