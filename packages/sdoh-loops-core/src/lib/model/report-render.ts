/**
 * SL28 point 4: the case report's formats, all made in the browser from one CaseReport — Markdown, one self-contained
 * HTML file (which Print / Save as PDF also uses: a print stylesheet, a page break before each note, black on white with
 * no meaning carried by colour), and Word (.docx). Loaded on first use, so the map's own bundle does not carry it.
 */
import type { Block, CaseReport, Part, ReportQuote } from './report';
import { zip } from '../zip';

export interface ReportImage {
  /** a PNG data URL of the canvas */
  png: string;
  alt: string;
}

const NOTEBOOK_SOURCES = 'In the notebook';
const where = (q: ReportQuote) => [q.note, q.anchor].filter(Boolean).join(' · ');
const pinsLine = (r: CaseReport) => `core ${r.cover.pins.core} · pack ${r.cover.pins.pack} · ${r.cover.pins.icd11}`;
const counts = (r: CaseReport) => {
  const p = r.cover.provenance;
  const lab = Object.entries(p.labelled)
    .filter(([, n]) => n)
    .map(([k, n]) => `${k} ${n}`)
    .join(', ');
  return [
    ['Notes', String(p.notes)],
    ['Passages', String(p.spans)],
    ['Mentions', String(p.mentions)],
    ['Annotations', `${p.annotations} (${p.comments} with a comment)`],
    ['Identifiers replaced by a label', p.labelledTotal ? `${p.labelledTotal} (${lab})` : '0'],
  ] as const;
};
const identifierLine = (r: CaseReport) =>
  r.cover.flaggedKept
    ? `${r.cover.flaggedKept} possible ${r.cover.flaggedKept === 1 ? 'identifier was' : 'identifiers were'} left in this report as written, as you confirmed before exporting.`
    : 'No possible identifiers were found in the notebook when this report was made.';

// ───────────────────────── Markdown
const mdEsc = (s: string) => s.replace(/([\\`*_[\]<>])/g, '\\$1');
const mdCell = (s: string) => mdEsc(s).replace(/\|/g, '\\|').replace(/\n+/g, ' ');
const mdParts = (ps: Part[]) => ps.map((p) => ('text' in p ? mdEsc(p.text) : `**${mdEsc(p.chip)}**`)).join('').replace(/\n/g, '  \n');
const mdBlock = (b: Block) => (b.kind === 'h' ? `#### ${mdParts(b.parts)}` : b.kind === 'li' ? `- ${mdParts(b.parts)}` : b.kind === 'page' ? `*${mdParts(b.parts)}*` : mdParts(b.parts));
const mdQuote = (q: ReportQuote) => `> “${mdEsc(q.quote)}”${q.inferred ? ' ≈' : ''}  \n> — ${mdEsc(where(q))}${q.by ? ` · suggested by ${mdEsc(q.by)}` : ''}`;

export function reportMarkdown(r: CaseReport, image?: ReportImage): string {
  const o: string[] = [];
  o.push(`# Case report: ${mdEsc(r.cover.name)}`, '');
  o.push(`- **Subject:** ${mdEsc(r.cover.subject || '—')}`, `- **Date:** ${r.cover.date}`, `- **Pins:** ${pinsLine(r)}`);
  for (const [k, v] of counts(r)) o.push(`- **${k}:** ${v}`);
  o.push('', `**Identifier check.** ${mdEsc(r.cover.heuristic)}`, '', mdEsc(identifierLine(r)), '', `*${mdEsc(r.cover.notice)}*`, '');
  if (image && r.options.image) o.push('## The map', '', `![${mdEsc(image.alt)}](${image.png})`, '');
  if (r.notes.length) {
    o.push('## Notes', '');
    for (const n of r.notes) {
      o.push(`### ${mdEsc(n.title)}`, '', `*${mdEsc(n.kind)}${n.date ? ` · ${n.date}` : ''}${n.source ? ` · ${mdEsc(n.source)}` : ''}*`, '');
      for (const s of n.sections) {
        if (s.heading) o.push(`**${mdEsc(s.heading)}**`, '');
        for (const b of s.blocks) o.push(mdBlock(b), '');
      }
      if (n.table) {
        o.push(`| ${n.table.header.map(mdCell).join(' | ')} |`, `| ${n.table.header.map(() => '---').join(' | ')} |`);
        for (const row of n.table.rows) o.push(`| ${row.map(mdCell).join(' | ')} |`);
        o.push('');
      }
      if (n.passages.length) {
        o.push(`**Passages (${n.passages.length})**`, '');
        for (const p of n.passages) o.push(mdQuote(p.quote), `> Supports: ${mdEsc(p.supports.join('; ') || 'nothing on the map')}${p.comment ? `  \n> Comment: ${mdEsc(p.comment)}` : ''}`, '');
      }
    }
  }
  o.push('## Case summary', '');
  for (const t of r.summary.tiles) o.push(`- **${t.label}:** ${t.value}${t.detail ? ` (${t.detail})` : ''}`);
  if (r.summary.hidden) o.push(`- ${r.summary.hidden} hidden circumstance(s) not shown.`);
  o.push('', '### Circumstances', '', '| Circumstance | Code and WHO title | Code status · type | Description | Links out and in | Sources |', '| --- | --- | --- | --- | --- | --- |');
  for (const x of r.summary.rows)
    o.push(`| ${mdCell(x.name)} | ${mdCell(x.code ? `${x.code} ${x.codeTitle}` : '—')} | ${mdCell(x.status)} | ${mdCell(x.description || '—')} | ${mdCell([...x.out.map((l) => `→ ${l}`), ...x.in.map((l) => `← ${l}`)].join('; ') || '—')} | ${x.sources.length} |`);
  o.push('');
  const withSources = r.summary.rows.filter((x) => x.sources.length);
  if (withSources.length) {
    o.push('### Sources', '');
    for (const x of withSources) {
      o.push(`**${mdEsc(x.name)}** — ${NOTEBOOK_SOURCES} (${x.sources.length})`, '');
      for (const q of x.sources) o.push(mdQuote(q), '');
    }
  }
  o.push(`### Loops (${r.summary.loops.length})`, '');
  if (!r.summary.loops.length) o.push('No loops yet.', '');
  for (const l of r.summary.loops) {
    o.push(`**${mdEsc(l.name)}** · ${l.kind}: ${mdEsc(l.cycle)}${l.total ? ` · ${l.total} passage${l.total === 1 ? '' : 's'}` : ''}`, '');
    for (const g of l.passages) {
      o.push(`*${mdEsc(g.label)}*`, '');
      for (const q of g.quotes) o.push(mdQuote(q), '');
    }
  }
  o.push('### Leverage, top 5', '', '*A heuristic: where several loops meet, not a recommendation.*', '');
  r.summary.leverage.forEach((x, i) => o.push(`${i + 1}. ${mdEsc(x.name)} · ${x.loops} loop${x.loops === 1 ? '' : 's'}`));
  o.push('', '## References cited in the notebook', '');
  if (!r.references.length) o.push('The notebook cites no references.');
  for (const x of r.references) o.push(`${x.userEntered ? `- ${x.n}.` : `${x.n}.`} ${mdEsc(x.citation)}${x.userEntered ? ' (user-entered)' : ''}${x.link ? ` <${x.link}>` : ''}`);
  o.push('', '---', '', mdEsc(r.cover.citation), '');
  return o.join('\n');
}

// ───────────────────────── HTML (the file, and Print / Save as PDF)
const h = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const hParts = (ps: Part[]) => ps.map((p) => ('text' in p ? h(p.text).replace(/\n/g, '<br>') : `<span class="chip" data-span="${h(p.span)}">${h(p.chip)}</span>`)).join('');
const hBlock = (b: Block) => (b.kind === 'h' ? `<h4>${hParts(b.parts)}</h4>` : b.kind === 'li' ? `<p class="li">• ${hParts(b.parts)}</p>` : b.kind === 'page' ? `<p class="page">${hParts(b.parts)}</p>` : `<p>${hParts(b.parts)}</p>`);
const hQuote = (q: ReportQuote) =>
  `<blockquote class="quote${q.inferred ? ' inferred' : ''}" data-span="${h(q.span)}"><q>${h(q.quote)}</q>${q.inferred ? ' <span aria-label="inferred">≈</span>' : ''}<footer>${h(where(q))}${q.by ? ` · suggested by ${h(q.by)}` : ''}</footer></blockquote>`;

const CSS = `
:root{color-scheme:light}
body{font:11pt/1.5 Georgia,'Times New Roman',serif;color:#000;background:#fff;margin:0 auto;max-width:48rem;padding:1.5rem}
h1{font-size:1.7rem;margin:0 0 .5rem}h2{font-size:1.3rem;margin:1.6rem 0 .5rem;border-bottom:1px solid #000}h3{font-size:1.1rem;margin:1.2rem 0 .4rem}h4{font-size:1rem;margin:.8rem 0 .2rem}
dl.cover{display:grid;grid-template-columns:max-content 1fr;gap:.15rem 1rem}dl.cover dt{font-weight:bold}dl.cover dd{margin:0}
.meta{font-style:italic}.notice{border:1px solid #000;padding:.5rem}
table{border-collapse:collapse;width:100%;font-size:9.5pt}th,td{border:1px solid #000;padding:.2rem .35rem;text-align:left;vertical-align:top}
blockquote.quote{margin:.4rem 0 .4rem 1rem;padding-left:.6rem;border-left:3px solid #000}blockquote.quote.inferred{border-left-style:dashed}
blockquote.quote footer{font-size:9pt;font-style:italic}.chip{border:1px solid #000;border-radius:.6rem;padding:0 .3rem;font-size:.92em}
p.li{margin:.1rem 0 .1rem 1rem}p.page{font-size:9pt;font-style:italic;margin:.6rem 0 .1rem}
.tiles{list-style:none;padding:0;display:flex;flex-wrap:wrap;gap:.5rem}.tiles li{border:1px solid #000;padding:.3rem .6rem}
img.map{max-width:100%;border:1px solid #000}
@page{margin:16mm}
@media print{body{max-width:none;padding:0}article.note{break-before:page}section.summary,section.refs{break-before:page}h2,h3,h4{break-after:avoid}blockquote,tr{break-inside:avoid}}
`;

export function reportHTML(r: CaseReport, image?: ReportImage): string {
  const o: string[] = [];
  o.push(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Case report: ${h(r.cover.name)}</title><style>${CSS}</style></head><body>`);
  o.push(`<header class="cover" data-section="cover"><h1>Case report: ${h(r.cover.name)}</h1><dl class="cover"><dt>Subject</dt><dd>${h(r.cover.subject || '—')}</dd><dt>Date</dt><dd>${r.cover.date}</dd><dt>Pins</dt><dd data-pins>${h(pinsLine(r))}</dd>`);
  for (const [k, v] of counts(r)) o.push(`<dt>${h(k)}</dt><dd>${h(v)}</dd>`);
  o.push(`</dl><p class="notice" data-heuristic><strong>Identifier check.</strong> ${h(r.cover.heuristic)}</p><p data-identifiers>${h(identifierLine(r))}</p><p class="meta">${h(r.cover.notice)}</p></header>`);
  if (image && r.options.image) o.push(`<section class="map-image"><h2>The map</h2><img class="map" src="${image.png}" alt="${h(image.alt)}"></section>`);
  if (r.notes.length) {
    o.push('<section class="notes"><h2>Notes</h2>');
    for (const n of r.notes) {
      o.push(`<article class="note" data-note="${h(n.id)}"><h3>${h(n.title)}</h3><p class="meta">${h(n.kind)}${n.date ? ` · ${h(n.date)}` : ''}${n.source ? ` · ${h(n.source)}` : ''}</p>`);
      for (const s of n.sections) {
        if (s.heading) o.push(`<h4>${h(s.heading)}</h4>`);
        o.push(...s.blocks.map(hBlock));
      }
      if (n.table) o.push(`<table><thead><tr>${n.table.header.map((c) => `<th scope="col">${h(c)}</th>`).join('')}</tr></thead><tbody>${n.table.rows.map((row) => `<tr>${row.map((c) => `<td>${h(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
      if (n.passages.length) {
        o.push(`<h4>Passages (${n.passages.length})</h4>`);
        for (const p of n.passages) o.push(hQuote(p.quote).replace('</footer>', `<br>Supports: ${h(p.supports.join('; ') || 'nothing on the map')}${p.comment ? `<br>Comment: ${h(p.comment)}` : ''}</footer>`));
      }
      o.push('</article>');
    }
    o.push('</section>');
  }
  o.push(`<section class="summary" data-section="summary"><h2>Case summary</h2><ul class="tiles">${r.summary.tiles.map((t) => `<li><strong>${t.value}</strong> ${h(t.label)}${t.detail ? `<br><small>${h(t.detail)}</small>` : ''}</li>`).join('')}</ul>`);
  if (r.summary.hidden) o.push(`<p>${r.summary.hidden} hidden circumstance(s) not shown.</p>`);
  o.push('<h3>Circumstances</h3><table data-table="circumstances"><thead><tr><th scope="col">Circumstance</th><th scope="col">Code and WHO title</th><th scope="col">Code status · type</th><th scope="col">Description</th><th scope="col">Links out and in</th><th scope="col">Sources</th></tr></thead><tbody>');
  for (const x of r.summary.rows)
    o.push(
      `<tr data-node="${h(x.id)}"><th scope="row">${h(x.name)}</th><td>${x.code ? `${h(x.code)} ${h(x.codeTitle)}` : '—'}</td><td>${h(x.status)}</td><td>${h(x.description || '—')}</td><td>${[...x.out.map((l) => `→ ${h(l)}`), ...x.in.map((l) => `← ${h(l)}`)].join('<br>') || '—'}</td><td>${x.sources.length ? `${x.sources.length} passage${x.sources.length === 1 ? '' : 's'}` : '—'}</td></tr>`,
    );
  o.push('</tbody></table>');
  const withSources = r.summary.rows.filter((x) => x.sources.length);
  if (withSources.length) {
    o.push('<h3>Sources</h3>');
    for (const x of withSources) o.push(`<h4>${h(x.name)} — ${NOTEBOOK_SOURCES} (${x.sources.length})</h4>`, ...x.sources.map(hQuote));
  }
  o.push(`<h3>Loops (${r.summary.loops.length})</h3>`);
  if (!r.summary.loops.length) o.push('<p>No loops yet.</p>');
  for (const l of r.summary.loops) {
    o.push(`<p data-loop><strong>${h(l.name)}</strong> · ${h(l.kind)}: ${h(l.cycle)}${l.total ? ` · ${l.total} passage${l.total === 1 ? '' : 's'}` : ''}</p>`);
    for (const g of l.passages) o.push(`<p class="meta">${h(g.label)}</p>`, ...g.quotes.map(hQuote));
  }
  o.push('<h3>Leverage, top 5</h3><p class="meta">A heuristic: where several loops meet, not a recommendation.</p><ol>', ...r.summary.leverage.map((x) => `<li>${h(x.name)} · ${x.loops} loop${x.loops === 1 ? '' : 's'}</li>`), '</ol></section>');
  o.push('<section class="refs" data-section="references"><h2>References cited in the notebook</h2>');
  if (!r.references.length) o.push('<p>The notebook cites no references.</p>');
  else o.push('<ul style="list-style:none;padding:0">', ...r.references.map((x) => `<li data-ref="${h(x.n)}">${x.userEntered ? '' : `[${h(x.n)}] `}${h(x.citation)}${x.userEntered ? ' (user-entered)' : ''}${x.link ? ` <a href="${h(x.link)}">${h(x.link)}</a>` : ''}</li>`), '</ul>');
  o.push(`</section><footer><p class="meta">${h(r.cover.citation)}</p></footer></body></html>`);
  return o.join('\n');
}

// ───────────────────────── Word (.docx)
// eslint-disable-next-line no-control-regex
const x = (s: string) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const run = (t: string, o: { b?: boolean; i?: boolean; size?: number } = {}) => {
  const props = `${o.b ? '<w:b/>' : ''}${o.i ? '<w:i/>' : ''}${o.size ? `<w:sz w:val="${o.size}"/>` : ''}`;
  return t
    .split('\n')
    .map((line, k) => `<w:r>${props ? `<w:rPr>${props}</w:rPr>` : ''}${k ? '<w:br/>' : ''}<w:t xml:space="preserve">${x(line)}</w:t></w:r>`)
    .join('');
};
const para = (runs: string, style?: string, extra = '') => `<w:p>${style || extra ? `<w:pPr>${style ? `<w:pStyle w:val="${style}"/>` : ''}${extra}</w:pPr>` : ''}${runs}</w:p>`;
const pageBreak = '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
const wParts = (ps: Part[]) => ps.map((p) => ('text' in p ? run(p.text) : run(p.chip, { b: true }))).join('');
const wBlock = (b: Block) => (b.kind === 'h' ? para(wParts(b.parts), 'Heading4') : b.kind === 'li' ? para(run('• ') + wParts(b.parts), undefined, '<w:ind w:left="360"/>') : b.kind === 'page' ? para(wParts(b.parts).replace(/<w:r>/g, '<w:r><w:rPr><w:i/></w:rPr>'), undefined) : para(wParts(b.parts)));
const wQuote = (q: ReportQuote, more = '') => para(run(`“${q.quote}”${q.inferred ? ' ≈' : ''}`) + run(`\n— ${where(q)}${q.by ? ` · suggested by ${q.by}` : ''}${more}`, { i: true, size: 18 }), 'Quote');
const cell = (t: string, head = false) => `<w:tc><w:tcPr><w:tcW w:w="0" w:type="auto"/></w:tcPr>${para(run(t, { b: head, size: 18 }))}</w:tc>`;
const table = (header: string[], rows: string[][]) =>
  `<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="5000" w:type="pct"/><w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((s) => `<w:${s} w:val="single" w:sz="4" w:space="0" w:color="000000"/>`).join('')}</w:tblBorders></w:tblPr><w:tr><w:trPr><w:tblHeader/></w:trPr>${header.map((c) => cell(c, true)).join('')}</w:tr>${rows.map((r) => `<w:tr>${r.map((c) => cell(c)).join('')}</w:tr>`).join('')}</w:tbl>`;

/** PNG width and height, from its IHDR chunk */
function pngSize(b: Uint8Array): { w: number; h: number } {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  return b.length > 24 ? { w: v.getUint32(16), h: v.getUint32(20) } : { w: 1, h: 1 };
}
function dataUrlBytes(url: string): Uint8Array {
  const bin = atob(url.slice(url.indexOf(',') + 1));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function reportDocx(r: CaseReport, image?: ReportImage): Uint8Array {
  const body: string[] = [];
  body.push(para(run(`Case report: ${r.cover.name}`), 'Title'));
  body.push(para(run('Subject: ', { b: true }) + run(r.cover.subject || '—')), para(run('Date: ', { b: true }) + run(r.cover.date)), para(run('Pins: ', { b: true }) + run(pinsLine(r))));
  for (const [k, v] of counts(r)) body.push(para(run(`${k}: `, { b: true }) + run(v)));
  body.push(para(run('Identifier check. ', { b: true }) + run(r.cover.heuristic)), para(run(identifierLine(r))), para(run(r.cover.notice, { i: true })));
  let png: Uint8Array | null = null;
  if (image && r.options.image) {
    png = dataUrlBytes(image.png);
    const { w, h: ht } = pngSize(png);
    const cx = 5486400; // 6 inches
    const cy = Math.round((cx * ht) / Math.max(1, w));
    body.push(para(run('The map'), 'Heading1'));
    body.push(
      `<w:p><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="1" name="Map" descr="${x(image.alt)}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="1" name="map.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdMap"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`,
    );
  }
  if (r.notes.length) {
    for (const n of r.notes) {
      body.push(pageBreak, para(run(n.title), 'Heading1'), para(run(`${n.kind}${n.date ? ` · ${n.date}` : ''}${n.source ? ` · ${n.source}` : ''}`, { i: true })));
      for (const s of n.sections) {
        if (s.heading) body.push(para(run(s.heading), 'Heading3'));
        body.push(...s.blocks.map(wBlock));
      }
      if (n.table) body.push(table(n.table.header, n.table.rows), para(''));
      if (n.passages.length) {
        body.push(para(run(`Passages (${n.passages.length})`), 'Heading3'));
        for (const p of n.passages) body.push(wQuote(p.quote, `\nSupports: ${p.supports.join('; ') || 'nothing on the map'}${p.comment ? `\nComment: ${p.comment}` : ''}`));
      }
    }
  }
  body.push(pageBreak, para(run('Case summary'), 'Heading1'));
  for (const t of r.summary.tiles) body.push(para(run(`${t.label}: `, { b: true }) + run(`${t.value}${t.detail ? ` (${t.detail})` : ''}`)));
  if (r.summary.hidden) body.push(para(run(`${r.summary.hidden} hidden circumstance(s) not shown.`)));
  body.push(para(run('Circumstances'), 'Heading2'));
  body.push(
    table(
      ['Circumstance', 'Code and WHO title', 'Code status · type', 'Description', 'Links out and in', 'Sources'],
      r.summary.rows.map((x) => [x.name, x.code ? `${x.code} ${x.codeTitle}` : '—', x.status, x.description || '—', [...x.out.map((l) => `→ ${l}`), ...x.in.map((l) => `← ${l}`)].join('\n') || '—', String(x.sources.length)]),
    ),
    para(''),
  );
  const withSources = r.summary.rows.filter((x) => x.sources.length);
  if (withSources.length) {
    body.push(para(run('Sources'), 'Heading2'));
    for (const x of withSources) body.push(para(run(`${x.name} — ${NOTEBOOK_SOURCES} (${x.sources.length})`), 'Heading3'), ...x.sources.map((q) => wQuote(q)));
  }
  body.push(para(run(`Loops (${r.summary.loops.length})`), 'Heading2'));
  if (!r.summary.loops.length) body.push(para(run('No loops yet.')));
  for (const l of r.summary.loops) {
    body.push(para(run(l.name, { b: true }) + run(` · ${l.kind}: ${l.cycle}${l.total ? ` · ${l.total} passage${l.total === 1 ? '' : 's'}` : ''}`)));
    for (const g of l.passages) body.push(para(run(g.label, { i: true })), ...g.quotes.map((q) => wQuote(q)));
  }
  body.push(para(run('Leverage, top 5'), 'Heading2'), para(run('A heuristic: where several loops meet, not a recommendation.', { i: true })));
  r.summary.leverage.forEach((v, i) => body.push(para(run(`${i + 1}. ${v.name} · ${v.loops} loop${v.loops === 1 ? '' : 's'}`))));
  body.push(pageBreak, para(run('References cited in the notebook'), 'Heading1'));
  if (!r.references.length) body.push(para(run('The notebook cites no references.')));
  for (const v of r.references) body.push(para(run(`${v.userEntered ? '' : `[${v.n}] `}${v.citation}${v.userEntered ? ' (user-entered)' : ''}${v.link ? ` ${v.link}` : ''}`)));
  body.push(para(run(r.cover.citation, { i: true, size: 16 })));

  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="${W}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><w:body>${body.join('')}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const style = (id: string, name: string, size: number, o: { b?: boolean; i?: boolean; ind?: boolean; level?: number } = {}) =>
    `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/>${o.ind ? '<w:ind w:left="567"/><w:pBdr><w:left w:val="single" w:sz="12" w:space="6" w:color="000000"/></w:pBdr>' : ''}<w:spacing w:before="160" w:after="80"/>${o.level !== undefined ? `<w:outlineLvl w:val="${o.level}"/>` : ''}</w:pPr><w:rPr>${o.b ? '<w:b/>' : ''}${o.i ? '<w:i/>' : ''}<w:sz w:val="${size}"/></w:rPr></w:style>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="${W}"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Georgia" w:hAnsi="Georgia" w:cs="Georgia"/><w:sz w:val="22"/><w:lang w:val="en-US"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="100"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>${style('Title', 'Title', 36, { b: true })}${style('Heading1', 'heading 1', 30, { b: true, level: 0 })}${style('Heading2', 'heading 2', 26, { b: true, level: 1 })}${style('Heading3', 'heading 3', 23, { b: true, level: 2 })}${style('Heading4', 'heading 4', 22, { b: true, i: true, level: 3 })}${style('Quote', 'Quote', 21, { ind: true })}<w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/></w:style></w:styles>`;
  const types = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${png ? '<Default Extension="png" ContentType="image/png"/>' : ''}<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`;
  const docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>${png ? '<Relationship Id="rIdMap" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/map.png"/>' : ''}</Relationships>`;
  // the document's own properties carry only the title the user gave the map — no author, no device
  const core = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${x(`Case report: ${r.cover.name}`)}</dc:title><dcterms:created xsi:type="dcterms:W3CDTF">${r.cover.provenance.exported}</dcterms:created></cp:coreProperties>`;
  return zip([
    { name: '[Content_Types].xml', data: types },
    { name: '_rels/.rels', data: rels },
    { name: 'docProps/core.xml', data: core },
    { name: 'word/document.xml', data: document },
    { name: 'word/styles.xml', data: styles },
    { name: 'word/_rels/document.xml.rels', data: docRels },
    ...(png ? [{ name: 'word/media/map.png', data: png }] : []),
  ]);
}
