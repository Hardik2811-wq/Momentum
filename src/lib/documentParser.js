/**
 * Document Parser for Momentum OS
 * Extracts plain text from PDF, DOCX, TXT, MD, CSV, JSON files directly in the browser.
 */
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

// Configure pdfjs worker if in browser
if (typeof window !== 'undefined') {
  try {
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '4.10.38'}/pdf.worker.min.mjs`;
    }
  } catch {}
}

/**
 * Extracts clean text from an uploaded File object.
 * @param {File} file 
 * @returns {Promise<{ name: string, type: string, text: string, charCount: number }>}
 */
export async function parseDocumentFile(file) {
  if (!file) throw new Error('No file provided');

  const name = file.name;
  const ext = name.split('.').pop()?.toLowerCase() || '';

  let text = '';

  if (['txt', 'md', 'markdown', 'json', 'csv', 'yaml', 'yml'].includes(ext) || file.type.startsWith('text/')) {
    text = await file.text();
  } else if (ext === 'docx' || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    text = result.value || '';
  } else if (ext === 'pdf' || file.type === 'application/pdf') {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
      useSystemFonts: true
    });
    const pdf = await loadingTask.promise;
    const pageTexts = [];
    const maxPages = Math.min(pdf.numPages, 30); // Guardrail to prevent freezing on 500-page books
    
    for (let i = 1; i <= maxPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const strings = content.items.map(item => item.str || '');
      pageTexts.push(strings.join(' '));
    }
    text = pageTexts.join('\n\n');
  } else {
    // Attempt fallback read as plain text
    try {
      text = await file.text();
    } catch {
      throw new Error(`Unsupported document format (.${ext}). Please upload PDF, DOCX, TXT, or MD.`);
    }
  }

  // Clean excessive whitespace and trim
  const cleanText = text.replace(/[\r\n]{3,}/g, '\n\n').trim();
  const outline = extractExecutiveOutline(cleanText, 2500);

  return {
    name,
    ext,
    type: file.type || ext,
    text: cleanText,
    outline,
    charCount: cleanText.length,
    outlineCharCount: outline.length
  };
}

/**
 * Extracts a high-density executive outline (headings, milestones, deliverables, bullet items)
 * from raw document text, reducing input token usage by up to 90%.
 */
export function extractExecutiveOutline(rawText = '', maxChars = 2500) {
  if (!rawText || rawText.length <= maxChars) return rawText || '';

  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const selectedLines = [];
  let currentLength = 0;

  const headerRegex = /^(#{1,4}\s|[A-Z0-9\s_-]{3,}:|[0-9]+\.\s+[A-Z]|Section|Phase|Chapter|Part|Milestone|Goal|Objective)/i;
  const actionRegex = /^(TODO|TASK|DELIVERABLE|ACTION|DEADLINE|HABIT|NOTE|OUTPUT|REQUIREMENT|FEATURE|SPRINT):?/i;
  const bulletRegex = /^([•\-*–—]|\d+\.)\s+/;
  const highValueKeyword = /\b(launch|deploy|build|design|test|milestone|deadline|budget|schedule|deliverable|priority|q[1-4]|kpi|target|weekly|daily)\b/i;

  for (const line of lines) {
    if (line.length < 3) continue;
    if (/\b(copyright|all rights reserved|confidential|terms\s+(?:and|&)\s+conditions|terms of service|table of contents|page \d+)\b/i.test(line)) continue;

    const isHeader = headerRegex.test(line);
    const isAction = actionRegex.test(line);
    const isBullet = bulletRegex.test(line);
    const hasKeyword = highValueKeyword.test(line);

    if (isHeader || isAction || (isBullet && hasKeyword) || line.endsWith(':')) {
      if (currentLength + line.length + 1 > maxChars) break;
      selectedLines.push(line);
      currentLength += line.length + 1;
    }
  }

  if (selectedLines.length < 2) {
    return rawText.slice(0, maxChars);
  }

  return selectedLines.join('\n');
}
