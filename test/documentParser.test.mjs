import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDocumentFile } from '../src/lib/documentParser.js';

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
});
