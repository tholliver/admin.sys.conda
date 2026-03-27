// Composite: "2026-02-12T21:30:03.000Z_7628"
export function encodeCursor(createdAt: Date, id: number): string {
    return `${createdAt.toISOString()}_${id}`;
}

export function decodeCursor(cursor: string): { createdAt: Date; id: number } {
    const idx = cursor.lastIndexOf("_");
    return {
        createdAt: new Date(cursor.slice(0, idx)),
        id: Number(cursor.slice(idx + 1)),
    };
}

// Simple: "2026-02-12T21:30:03.000Z"
export function encodeSimpleCursor(createdAt: Date): string {
    return createdAt.toISOString();
}

export function decodeSimpleCursor(cursor: string): Date {
    return new Date(cursor);
}
