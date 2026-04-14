/**
 * File Parser — Extracts text from uploaded files (PDF, TXT, CSV)
 * Used by knowledge API routes to make uploaded files searchable by the AI chat engine.
 */

export async function parseFileContent(base64Content: string, mimeType: string, fileName: string): Promise<string> {
    const buffer = Buffer.from(base64Content, 'base64');

    // PDF parsing
    if (mimeType === 'application/pdf' || fileName.endsWith('.pdf')) {
        try {
            const pdfParse = require('pdf-parse');
            const data = await pdfParse(buffer);
            const text = data.text?.trim();
            if (text && text.length > 10) {
                return `# 📄 ${fileName}\n\n${text}`;
            }
            return `[PDF file: ${fileName} — could not extract text]`;
        } catch (err) {
            console.warn(`Failed to parse PDF "${fileName}":`, err);
            return `[PDF file: ${fileName} — parse error]`;
        }
    }

    // Plain text files (TXT, CSV, MD, JSON)
    if (
        mimeType.startsWith('text/') ||
        mimeType === 'application/json' ||
        mimeType === 'application/csv' ||
        fileName.match(/\.(txt|csv|md|json|log|xml|html)$/i)
    ) {
        try {
            const text = buffer.toString('utf-8');
            if (text && text.length > 5) {
                return `# 📄 ${fileName}\n\n${text}`;
            }
        } catch { }
    }

    // Fallback — can't parse, return metadata
    return `[File: ${fileName} (${mimeType}) — binary file, content not extractable]`;
}
