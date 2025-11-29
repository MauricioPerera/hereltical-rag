import crypto from 'node:crypto';

export async function embed(text: string): Promise<number[]> {
    // Create a deterministic embedding based on the input text
    // This ensures that the same text always yields the same vector,
    // and similar texts might yield somewhat similar vectors if we were clever,
    // but for now, just stability is enough for exact match testing.

    const hash = crypto.createHash('sha256').update(text).digest('hex');

    // Generate 1536 dimensions from the hash
    const vector: number[] = [];
    for (let i = 0; i < 1536; i++) {
        // Use parts of the hash to generate numbers
        // This is a very simple pseudo-random generator seeded by the hash
        const charCode = hash.charCodeAt(i % hash.length);
        const val = (charCode + i) % 100 / 100; // Normalize roughly 0-1
        vector.push(val);
    }

    return vector;
}
