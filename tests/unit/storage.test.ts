/** Storage adapter (save, load, migrate, clear) and export/import round-trip. */
import 'fake-indexeddb/auto';
import { describe, expect, it, beforeEach } from 'vitest';
import { createStore } from 'idb-keyval';
import { idbStore, localStore } from '../../src/lib/storage';
import { addEdge, addNode, migrate, newEdge, newMap, newNode, ImportError, SCHEMA_VERSION, updateNode, deleteNodes } from '../../src/lib/model/map';
import { docFromText, plainText, sanitizeRich } from '../../src/lib/model/rich';
import { exportCSV, exportJSON, importCSV, importJSON, loopReportMD } from '../../src/lib/model/interchange';
import { findLoops } from '../../src/lib/analysis';
import { toGraph } from '../../src/lib/model/map';

class MemStorage implements Storage {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  clear() { this.m.clear(); }
  getItem(k: string) { return this.m.get(k) ?? null; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  removeItem(k: string) { this.m.delete(k); }
  setItem(k: string, v: string) { this.m.set(k, v); }
}

function w1Map() {
  let m = newMap('Client R.', 'R.');
  const h = newNode({ code_status: 'sdoh', code: 'QD71.1', circumstance: docFromText('Behind on rent; landlord filed for eviction') });
  const u = newNode({ code_status: 'sdoh', code: 'QD80', circumstance: docFromText('Missed shifts during the move; let go') });
  const i = newNode({ code_status: 'sdoh', code: 'QD51', circumstance: docFromText('No paycheck since March') });
  const o = newNode({ code_status: 'other', type: 'outcome', label: docFromText('Self-rated health'), ref: 'user ref' });
  const q = newNode({ code_status: 'undetermined', label: docFromText('Support from sister') });
  for (const n of [h, u, i, o, q]) m = addNode(m, n);
  m = addEdge(m, newEdge({ from: h.id, to: u.id, polarity: '+', evidence: [23], link: 'L03' }));
  m = addEdge(m, newEdge({ from: u.id, to: i.id, polarity: '+' }));
  m = addEdge(m, newEdge({ from: i.id, to: h.id, polarity: '+', weight: 0.75, description: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: "Can't make rent", marks: [{ type: 'bold' }] }] }] } }));
  m = addEdge(m, newEdge({ from: q.id, to: i.id, polarity: '−', weight: -0.5, delay: true, confidence: 'low' }));
  return { m, h, u, i, o, q };
}
const titles: Record<string, string> = { 'QD71.1': 'Inadequate housing', QD80: 'Problem associated with unemployment', QD51: 'Low income' };
const titleOf = (c: string) => titles[c];

describe('storage adapters', () => {
  for (const [name, make] of [
    ['indexeddb', () => idbStore(createStore(`test-${Math.random()}`, 'maps'))],
    ['localstorage', () => localStore(new MemStorage())],
  ] as const) {
    describe(name, () => {
      let store: ReturnType<typeof make>;
      beforeEach(() => { store = make(); });
      it('saves, lists and loads a map losslessly', async () => {
        const { m } = w1Map();
        await store.save(m);
        expect(await store.list()).toEqual([{ id: m.id, name: 'Client R.', updated: m.updated, nodes: 5, edges: 4 }]);
        expect(await store.load(m.id)).toEqual(m);
      });
      it('removes one map and clears all', async () => {
        const a = newMap('A');
        const b = newMap('B');
        await store.save(a);
        await store.save(b);
        await store.remove(a.id);
        expect((await store.list()).map((x) => x.name)).toEqual(['B']);
        await store.clearAll();
        expect(await store.list()).toEqual([]);
      });
    });
  }
});

describe('model rules', () => {
  it('refuses a weight that disagrees with polarity, and a self-loop', () => {
    const { m, h, u } = w1Map();
    expect(() => addEdge(m, newEdge({ from: h.id, to: u.id, polarity: '+', weight: -0.5 }))).toThrow(/sign must match/);
    expect(() => addEdge(m, newEdge({ from: h.id, to: h.id, polarity: '+' }))).toThrow(/self-loops are refused/);
  });
  it('recoding between states keeps edges and the description', () => {
    const { m, q } = w1Map();
    const m2 = updateNode(m, q.id, { code_status: 'sdoh', code: 'QD82' });
    expect(m2.edges).toHaveLength(m.edges.length);
    expect(plainText(m2.nodes.find((n) => n.id === q.id)!.label)).toBe('Support from sister');
    const m3 = updateNode(m2, q.id, { code_status: 'other', type: 'personal' });
    expect(m3.nodes.find((n) => n.id === q.id)!.code).toBeNull();
    expect(m3.edges).toHaveLength(m.edges.length);
  });
  it('deleting a node deletes its edges', () => {
    const { m, i } = w1Map();
    expect(deleteNodes(m, [i.id]).edges).toHaveLength(1);
  });
});

describe('migrate', () => {
  it('refuses a newer schema with a clear message', () => {
    const { m } = w1Map();
    expect(() => migrate({ ...m, schema_version: SCHEMA_VERSION + 1 })).toThrow(ImportError);
    expect(() => migrate({ ...m, schema_version: SCHEMA_VERSION + 1 })).toThrow(/newer version/);
  });
  it('refuses a file without schema_version', () => {
    expect(() => migrate({ nodes: [], edges: [] })).toThrow(/no schema_version/);
  });
  it('keeps unknown fields rather than dropping them', () => {
    const { m } = w1Map();
    const x = migrate({ ...m, custom_top: 1, nodes: m.nodes.map((n) => ({ ...n, custom_node: 'k' })) });
    expect(x.custom_top).toBe(1);
    expect(x.nodes[0].custom_node).toBe('k');
  });
  it('sanitises rich text: no HTML, only allowed marks', () => {
    const d = sanitizeRich({ type: 'doc', content: [{ type: 'heading', content: [{ type: 'text', text: '<b>x</b>', marks: [{ type: 'link', attrs: { href: 'http://evil' } }, { type: 'bold' }, { type: 'textStyle', attrs: { color: 'javascript:1', fontSize: '19px' } }] }] }] });
    expect(d).toEqual({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '<b>x</b>', marks: [{ type: 'bold' }, { type: 'textStyle', attrs: { color: null, fontSize: '19px' } }] }] }] });
  });
});

describe('export / import round-trip', () => {
  it('JSON round-trips nodes, edges, weights, polarities and the loop list', () => {
    const { m } = w1Map();
    const back = importJSON(exportJSON(m));
    expect(back).toEqual(m);
    expect(findLoops(toGraph(back))).toEqual(findLoops(toGraph(m)));
  });
  it('CSV carries code_status and type, and re-imports to the same graph', () => {
    const { m } = w1Map();
    const csv = exportCSV(m, titleOf);
    expect(csv.split('\n')[0]).toContain('from_code_status,from_type');
    expect(csv).toContain(',undetermined,');
    const back = importCSV(csv, 'from csv', (c) => c in titles || c === 'QD82');
    expect(back.edges.map((e) => [e.polarity, e.weight, e.delay, e.confidence])).toEqual(m.edges.map((e) => [e.polarity, e.weight, e.delay, e.confidence]));
    expect(findLoops(toGraph(back)).loops.map((l) => l.kind)).toEqual(['R']);
    expect(back.nodes.map((n) => n.code_status).sort()).toEqual(['sdoh', 'sdoh', 'sdoh', 'undetermined']);
  });
  it('CSV import refuses an unknown code', () => {
    expect(() => importCSV('from_label,from_code,to_label,polarity\nA,QX00,B,+\n', 'x', () => false)).toThrow(/not an ICD-11 code/);
  });
  it('the loop report lists the loop with its heuristic label', () => {
    const { m } = w1Map();
    const md = loopReportMD(m, titleOf, { strengthLabel: 'Loop strength — structural heuristic, not loop dominance', reinforcing: 'Reinforcing', balancing: 'Balancing', truncated: 'Truncated', none: 'No loops', notice: 'notice' });
    expect(md).toContain('| R1 | Reinforcing | 3 |');
    expect(md).toContain('structural heuristic');
  });
});
