import OpenAI from 'openai';
import { config } from '../config.js';

let openaiClient: OpenAI | null = null;

/**
 * Initialize OpenAI client (lazy initialization)
 */
function getOpenAIClient(): OpenAI {
    if (!openaiClient) {
        if (!config.openai.apiKey) {
            throw new Error('OPENAI_API_KEY is not set. Please set it in environment variables or .env file');
        }
        openaiClient = new OpenAI({
            apiKey: config.openai.apiKey
        });
    }
    return openaiClient;
}

/**
 * Generate embeddings using OpenAI API
 * @param text - Text to embed
 * @returns Embedding vector (1536 dimensions for text-embedding-3-small)
 */
export async function generateOpenAIEmbedding(text: string): Promise<number[]> {
    const client = getOpenAIClient();
    
    try {
        const response = await client.embeddings.create({
            model: config.openai.embeddingModel,
            input: text,
            encoding_format: 'float'
        });
        
        if (!response.data || response.data.length === 0) {
            throw new Error('No embedding returned from OpenAI API');
        }
        
        return response.data[0].embedding;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`OpenAI embedding generation failed: ${error.message}`);
        }
        throw error;
    }
}

/**
 * Generate embeddings for multiple texts in batch
 * @param texts - Array of texts to embed
 * @returns Array of embedding vectors
 */
export async function generateOpenAIEmbeddingsBatch(texts: string[]): Promise<number[][]> {
    const client = getOpenAIClient();
    
    try {
        const response = await client.embeddings.create({
            model: config.openai.embeddingModel,
            input: texts,
            encoding_format: 'float'
        });
        
        if (!response.data || response.data.length === 0) {
            throw new Error('No embeddings returned from OpenAI API');
        }
        
        // Sort by index to maintain order
        return response.data
            .sort((a, b) => a.index - b.index)
            .map(item => item.embedding);
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`OpenAI batch embedding generation failed: ${error.message}`);
        }
        throw error;
    }
}

