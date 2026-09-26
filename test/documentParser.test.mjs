import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDocumentFile, extractExecutiveOutline } from '../src/lib/documentParser.js';

test('parseDocumentFile extracts text from plain text file', async () => {
  const mockFile = {
    name: 'project_spec.txt',
    type: 'text/plain',
    text: async () => 'Goal: Ship MVP by Q4\nTasks:\n1. Audit auth schema\n2. Run performance benchmarks'
  };

  const parsed = await parseDocumentFile(mockFile);
  assert.equal(parsed.name, 'project_spec.txt');
  assert.equal(parsed.ext, 'txt');
  assert.ok(parsed.text.includes('Ship MVP by Q4'));
  assert.ok(parsed.charCount > 20);
});

test('parseDocumentFile extracts text from markdown file', async () => {
  const mockFile = {
    name: 'roadmap.md',
    type: 'text/markdown',
    text: async () => '# Product Roadmap\n\n## Habits\n- Read 20 mins every morning\n\n## Deliverables\n- Deploy production build'
  };

  const parsed = await parseDocumentFile(mockFile);
  assert.equal(parsed.name, 'roadmap.md');
  assert.equal(parsed.ext, 'md');
  assert.ok(parsed.text.includes('Product Roadmap'));
  assert.ok(Boolean(parsed.outline));
});

test('extractExecutiveOutline filters fluff and extracts structural deliverables', () => {
  const longDoc = `
  Terms and conditions: confidential copyright 2026.
  All rights reserved. Page 1 of 50.
  
  # Phase 1: Core Engine Launch
  Here is some long narrative paragraph explaining historical motivation that uses many tokens but has no action.
  
  DELIVERABLE: Deploy WebSocket sync service
  - Step 1: Run load test benchmark for 10k users
  - Step 2: Configure Redis pub/sub queue
  
  Random narrative discussion about team culture and office seating arrangements that consumes tokens.
  
  # Phase 2: iOS Native Bridge
  - Milestone: Complete Swift package target
  `;

  const outline = extractExecutiveOutline(longDoc, 500);
  assert.ok(outline.includes('Core Engine Launch'));
  assert.ok(outline.includes('DELIVERABLE: Deploy WebSocket sync service'));
  assert.ok(outline.includes('Step 1: Run load test benchmark'));
  assert.ok(!outline.includes('office seating arrangements'));
  assert.ok(!outline.includes('copyright 2026'));
});
