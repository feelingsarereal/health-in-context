/** SL22: <Notice text> — an embedding app's own safety.yaml notice; without it, the pinned pack's (the standalone app's). */
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Notice, safety, S, C } from '../../packages/sdoh-loops-core/src';

const HOST = 'This explorer is for learning; it says nothing about any one person.';

describe('Notice', () => {
  it('without `text` it shows the pack notice, in the banner and in the plain section', () => {
    const banner = renderToStaticMarkup(<Notice />);
    expect(banner).toContain(safety.notice.replace(/'/g, '&#x27;').replace(/"/g, '&quot;'));
    expect(banner).toContain(S.first_run.title);
    expect(banner).toContain('role="note"');
    const plain = renderToStaticMarkup(<Notice plain />);
    expect(plain).toContain(C.notice.plainTitle);
    expect(plain).toContain(safety.notice.replace(/'/g, '&#x27;').replace(/"/g, '&quot;'));
  });
  it('with `text` it shows the host’s words instead, keeping the markup (role, heading, test ids)', () => {
    for (const el of [<Notice text={HOST} />, <Notice text={HOST} compact />, <Notice text={HOST} plain />]) {
      const html = renderToStaticMarkup(el);
      expect(html).toContain('This explorer is for learning; it says nothing about any one person.');
      expect(html).not.toContain(safety.notice.slice(0, 40).replace(/'/g, '&#x27;'));
      expect(html).toContain('data-testid="notice"');
      expect(html).toContain('data-testid="notice-text"');
      expect(html).toContain('role="note"');
    }
  });
  it('`text` may be a short node', () => {
    const html = renderToStaticMarkup(<Notice text={<>Not advice. <a href="/help">Where to get help</a>.</>} />);
    expect(html).toContain('<a href="/help">Where to get help</a>');
  });
});
