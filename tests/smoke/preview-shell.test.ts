import { describe, expect, it } from 'vitest';

import { assemblePreviewBundle } from '../../src/pipeline/preview/previewAssembler';
import { PreviewShell, renderPreviewShell } from '../../src/ui/previewShell';

describe('preview shell rendering', () => {
  it('renders one canonical preview payload for chat summary and webview view model', () => {
    const assembled = assemblePreviewBundle({
      requestId: 'req_preview_shell_1',
      files: [
        {
          path: 'tests/checkout/checkout.spec.ts',
          changeType: 'modified',
          previousContent: "test('checkout', async () => {\n  await page.goto('/checkout');\n});\n",
          nextContent: "test('checkout success', async () => {\n  await page.goto('/checkout');\n  await expect(page).toHaveURL(/checkout/);\n});\n"
        },
        {
          path: 'tests/orders/orders.spec.ts',
          changeType: 'added',
          previousContent: '',
          nextContent: "test('orders list', async () => {\n  await page.goto('/orders');\n});\n"
        }
      ]
    });

    expect(assembled.previewBundle.summary.totalFiles).toBe(2);
    expect(assembled.previewBundle.fileDiffs).toHaveLength(2);
    expect(assembled.chatSummary).toContain('Files: 2');
    expect(assembled.webview.previewModel.fileDiffs[0]?.unifiedPatch).toContain('@@');

    const html = renderPreviewShell({
      requestId: assembled.requestId,
      state: 'awaiting_script_approval',
      chatSummary: assembled.chatSummary,
      previewModel: assembled.webview.previewModel
    });

    expect(html).toContain('PlaywrightAgent Script Preview');
    expect(html).toContain('Approve All Changes');
    expect(html).toContain('id="preview-root"');
    expect(html).toContain('id="preview-model"');
    expect(html).toContain(assembled.chatSummary);
    expect(html).toContain('unifiedPatch');
  });

  it('sanitizes summary and patch content before rendering to webview', () => {
    const assembled = assemblePreviewBundle({
      requestId: 'req_preview_shell_2',
      files: [
        {
          path: 'tests/security/token.spec.ts',
          changeType: 'modified',
          previousContent: "test('token', async () => {\n  const token = 'safe';\n});\n",
          nextContent: "test('token', async () => {\n  const value = '<script>alert(1)</script>';\n  const auth = 'Bearer abc.def.ghi';\n});\n"
        }
      ]
    });

    const html = renderPreviewShell({
      requestId: assembled.requestId,
      state: 'ready_to_write',
      chatSummary: assembled.chatSummary,
      previewModel: assembled.webview.previewModel
    });

    expect(html).not.toContain('alert(1)');
    expect(html).not.toContain('Bearer abc.def.ghi');
    expect(html).toContain('Bearer [REDACTED]');

    const shell = new PreviewShell();
    shell.open({
      requestId: assembled.requestId,
      state: 'ready_to_write',
      chatSummary: assembled.chatSummary,
      previewModel: assembled.webview.previewModel
    });

    expect(shell.getLastPayload()?.requestId).toBe('req_preview_shell_2');
    expect(shell.getLastPayload()?.state).toBe('ready_to_write');
  });
});
