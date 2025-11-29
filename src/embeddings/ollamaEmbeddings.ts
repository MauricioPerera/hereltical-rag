import { config } from '../config.js';

interface OllamaEmbedRequest {
    model: string;
    prompt: string;
}

interface OllamaEmbedResponse {
    embedding: number[];
}

/**
 * Generate embeddings using Ollama (local LLM server)
 * @param text - Text to embed
 * @returns Embedding vector
 */
export async function generateOllamaEmbedding(text: string): Promise<number[]> {
    const ollamaUrl = config.ollama.url;
    const model = config.ollama.embeddingModel;

    try {
        const response = await fetch(`${ollamaUrl}/api/embeddings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model,
                prompt: text,
            } as OllamaEmbedRequest),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Ollama API error (${response.status}): ${errorText}`);
        }

        const data = await response.json() as OllamaEmbedResponse;

        if (!data.embedding || !Array.isArray(data.embedding)) {
            throw new Error('Invalid response from Ollama: missing embedding array');
        }

        return data.embedding;
    } catch (error) {
        if (error instanceof Error) {
            // Check if it's a connection error
            if (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED')) {
                throw new Error(
                    `Cannot connect to Ollama at ${ollamaUrl}. ` +
                    `Make sure Ollama is running (ollama serve) and the model '${model}' is installed.`
                );
            }
            throw new Error(`Ollama embedding generation failed: ${error.message}`);
        }
        throw error;
    }
}

/**
 * Generate embeddings for multiple texts using Ollama
 * Note: Ollama doesn't have native batch support, so we process sequentially
 * @param texts - Array of texts to embed
 * @returns Array of embedding vectors
 */
export async function generateOllamaEmbeddingsBatch(texts: string[]): Promise<number[][]> {
    // Ollama doesn't have native batch API, so we process one by one
    // Could be optimized with Promise.all for parallel processing
    const embeddings: number[][] = [];
    
    for (const text of texts) {
        const embedding = await generateOllamaEmbedding(text);
        embeddings.push(embedding);
    }
    
    return embeddings;
}

/**
 * Check if Ollama server is available
 * @returns Promise resolving to true if server is reachable
 */
export async function checkOllamaAvailability(): Promise<boolean> {
    const ollamaUrl = config.ollama.url;
    
    try {
        const response = await fetch(`${ollamaUrl}/api/tags`, {
            method: 'GET',
        });
        return response.ok;
    } catch {
        return false;
    }
}

/**
 * List available models in Ollama
 * @returns Promise resolving to array of model names
 */
export async function listOllamaModels(): Promise<string[]> {
    const ollamaUrl = config.ollama.url;
    
    try {
        const response = await fetch(`${ollamaUrl}/api/tags`, {
            method: 'GET',
        });
        
        if (!response.ok) {
            throw new Error(`Failed to list models: ${response.status}`);
        }
        
        const data = await response.json() as { models: Array<{ name: string }> };
        return data.models.map(m => m.name);
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to list Ollama models: ${error.message}`);
        }
        throw error;
    }
}

