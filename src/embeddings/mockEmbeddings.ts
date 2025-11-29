import crypto from 'node:crypto';

/**
 * Mock embedding service for testing and development.
 * Generates deterministic embeddings based on text content using SHA-256 hashing.
 * This ensures same text always produces same vector.
 */
export async function generateMockEmbedding(text: string): Promise<number[]> {
    // Create a deterministic embedding based on the input text
    const hash = crypto.createHash('sha256').update(text).digest('hex');

    // Generate 1536 dimensions from the hash
    const vector: number[] = [];
    for (let i = 0; i < 1536; i++) {
        // Use parts of the hash to generate numbers
        const charCode = hash.charCodeAt(i % hash.length);
        const val = (charCode + i) % 100 / 100; // Normalize roughly 0-1
        vector.push(val);
    }

    return vector;
}

