import { describe, expect, it } from 'vitest';

import { buildUnifiedFileDiffs } from '../../src/pipeline/preview/diffBuilder';
import { PREVIEW_VERSION, assertPreviewBundle, createPreviewBundle } from '../../src/pipeline/preview/previewContracts';

describe('preview contracts and deterministic diff builder', () => {
  it('requires summary and unified patch data in one canonical payload', () => {
    const fileDiffs = buildUnifiedFileDiffs(
      [
        {
          path: 'tests/example.spec.ts',
          changeType: 'modified',
          previousContent: "test('old', async () => {\n  expect(true).toBe(true);\n});\n",
          nextContent: "test('new', async () => {\n  expect(true).toBe(true);\n});\n"
        }
      ],
      { previewVersion: PREVIEW_VERSION }
    );

    const bundle = createPreviewBundle({
      requestId: 'req_preview_contract_1',
      previewVersion: PREVIEW_VERSION,
      chatSummary: '1 file updated for preview',
      summary: {
        totalFiles: fileDiffs.length,
        addedFiles: 0,
        modifiedFiles: 1,
        deletedFiles: 0,
        totalAddedLines: fileDiffs[0]?.addedLineCount ?? 0,
        totalRemovedLines: fileDiffs[0]?.removedLineCount ?? 0
      },
      fileDiffs
    });

    expect(() => assertPreviewBundle(bundle)).not.toThrow();
    expect(bundle.summary.totalFiles).toBe(1);
    expect(bundle.fileDiffs[0]?.unifiedPatch.length).toBeGreaterThan(0);

    expect(() => assertPreviewBundle({
      requestId: 'req_preview_contract_1',
      previewVersion: PREVIEW_VERSION,
      chatSummary: 'summary only',
      summary: bundle.summary
    })).toThrow();

    expect(() => assertPreviewBundle({
      requestId: 'req_preview_contract_1',
      previewVersion: PREVIEW_VERSION,
      chatSummary: 'patch only',
      fileDiffs: bundle.fileDiffs
    })).toThrow();

    expect(() => assertPreviewBundle({
      requestId: 'req_preview_contract_1',
      previewVersion: PREVIEW_VERSION,
      chatSummary: 'invalid patch',
      summary: bundle.summary,
      fileDiffs: [
        {
          ...bundle.fileDiffs[0],
          unifiedPatch: ''
        }
      ]
    })).toThrow();
  });

  it('builds deterministic unified patches for the same input set', () => {
    const inputs = [
      {
        path: 'b/new-file.spec.ts',
        changeType: 'added' as const,
        previousContent: '',
        nextContent: "test('b', async () => {\n  expect(2).toBe(2);\n});\n"
      },
      {
        path: 'a/existing-file.spec.ts',
        changeType: 'modified' as const,
        previousContent: "test('a', async () => {\n  expect(1).toBe(1);\n});\n",
        nextContent: "test('a', async () => {\n  expect(3).toBe(3);\n});\n"
      }
    ];

    const first = buildUnifiedFileDiffs(inputs, { previewVersion: PREVIEW_VERSION });
    const second = buildUnifiedFileDiffs(inputs, { previewVersion: PREVIEW_VERSION });

    expect(first).toEqual(second);
    expect(first.map((item) => item.path)).toEqual(['a/existing-file.spec.ts', 'b/new-file.spec.ts']);
    expect(first.every((item) => item.previewVersion === PREVIEW_VERSION)).toBe(true);
    expect(first.every((item) => item.unifiedPatch.includes('--- a/'))).toBe(true);
    expect(first.every((item) => item.unifiedPatch.includes('+++ b/'))).toBe(true);
  });
});
