/** SL26: the notebook model — schema 3 migration both ways, the identifier patterns, the labeler. */
import { describe, expect, it } from 'vitest';
import { migrate, newMap, SCHEMA_VERSION, withoutNotebook, ImportError } from '../../packages/sdoh-loops-core/src/lib/model/map';
import { exportJSON, importJSON } from '../../packages/sdoh-loops-core/src/lib/model/interchange';
import { docFromText } from '../../packages/sdoh-loops-core/src/lib/model/rich';
import { findIdentifiers, IDENTIFIER_CATEGORIES, type IdentifierCategory } from '../../packages/sdoh-loops-core/src/lib/model/identifiers';
import {
  addNote, CORE_TEMPLATES, dismissFlag, duplicateNote, labelAll, labelFlag, moveNote, newFreeNote, newStructuredNote, notebookFlags, noteDocText, sanitizeNote, searchNotes, updateNote, type Notebook,
} from '../../packages/sdoh-loops-core/src/lib/model/notebook';

const free = (title: string, text: string) => ({ ...newFreeNote(title), body: sanitizeNote(docFromText(text)) });
const nbWith = (...notes: ReturnType<typeof free>[]): Notebook => notes.reduce<Notebook | undefined>((nb, n) => addNote(nb, n), undefined)!;

describe('SL26 schema 3', () => {
  it('is schema 3', () => expect(SCHEMA_VERSION).toBe(3));
  it('a schema 1 file and a schema 2 file open unchanged, with no notebook block', () => {
    const m = newMap('Old');
    for (const v of [1, 2]) {
      const out = migrate({ ...m, schema_version: v });
      expect(out.schema_version).toBe(3);
      expect('notebook' in out).toBe(false);
      expect({ ...out, schema_version: v }).toEqual({ ...m, schema_version: v });
    }
  });
  it('a schema 3 file keeps its notebook through export and import', () => {
    const m = { ...newMap('Case'), notebook: nbWith(free('Intake call', 'Behind on rent since the spring.')) };
    const text = exportJSON(m);
    expect(JSON.parse(text).schema_version).toBe(3);
    const back = importJSON(text);
    expect(back.notebook).toEqual(m.notebook);
  });
  it('down: a map without notes, or "without the notebook", is written as schema 2 and opens in schema 3 again', () => {
    const m = { ...newMap('Case'), notebook: nbWith(free('N', 'text')) };
    const bare = JSON.parse(exportJSON(withoutNotebook(m)));
    expect(bare.schema_version).toBe(2);
    expect(bare.notebook).toBeUndefined();
    expect(JSON.parse(exportJSON(newMap('Empty'))).schema_version).toBe(2);
    const up = importJSON(JSON.stringify(bare));
    expect(up.schema_version).toBe(3);
    expect({ ...up, notebook: m.notebook }).toEqual({ ...m, schema_version: 3, updated: up.updated });
  });
  it('a newer schema is still refused', () => {
    expect(() => migrate({ ...newMap('x'), schema_version: 4 })).toThrow(ImportError);
  });
  it('the notebook block is sanitized on load: unknown nodes flattened, marks restricted, headings and lists kept', () => {
    const body = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Housing', marks: [{ type: 'bold' }, { type: 'link', attrs: { href: 'https://x' } }] }] },
        { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'one' }] }] }] },
        { type: 'image', attrs: { src: 'https://x/y.png' } },
        { type: 'paragraph', content: [{ type: 'text', text: '<script>' }] },
      ],
    };
    const out = migrate({ ...newMap('x'), notebook: { notes: [{ id: 'n1', title: 'T', kind: 'free', body, tags: ['a', 3, 'a'] }], dismissed: [], replaced: { person: 2, bogus: 5 } } });
    const nb = out.notebook!;
    expect(nb.notes[0].body.content).toEqual([
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Housing', marks: [{ type: 'bold' }] }] },
      { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'one' }] }] }] },
      { type: 'paragraph' },
      { type: 'paragraph', content: [{ type: 'text', text: '<script>' }] },
    ]);
    expect(nb.notes[0].tags).toEqual(['a']);
    expect(nb.replaced).toEqual({ person: 2 });
  });
});

describe('SL26 identifier patterns: a positive and a negative fixture per category', () => {
  const POS: Record<IdentifierCategory, [string, string][]> = {
    person: [['Spoke with Mr. Jones about rent.', 'Mr. Jones'], ['She said my name is Ana Ruiz and', 'Ana Ruiz'], ['Dr Patel called back', 'Dr Patel']],
    date: [['Seen on 3/14/2024 at home', '3/14/2024'], ['Since March 14, 2024 the', 'March 14, 2024'], ['moved 2024-03-14', '2024-03-14'], ['on 14 March 2024', '14 March 2024'], ['since March 2024', 'March 2024']],
    phone: [['Call (256) 555-0134 after five', '(256) 555-0134'], ['cell 256.555.0134', '256.555.0134'], ['+1 256-555-0134', '+1 256-555-0134']],
    email: [['write to ana.ruiz@example.org today', 'ana.ruiz@example.org']],
    address: [['lives at 1420 Oak Street, Apt 3B now', '1420 Oak Street, Apt 3B'], ['She lives at 1420 Oak Street.', '1420 Oak Street'], ['moved to 22 N Main St.', '22 N Main St.'], ['mail to P.O. Box 118', 'P.O. Box 118']],
    zip: [['ZIP 35801-1234 on file', '35801-1234']],
    ssn: [['number 123-45-6789 on the form', '123-45-6789']],
    record: [['MRN 4481923 in the chart', 'MRN 4481923'], ['case #A-20931 opened', 'case #A-20931'], ['ref 90817264 noted', '90817264']],
  };
  const NEG: Record<IdentifierCategory, string> = {
    person: 'my name is not something I share; Mr said nothing',
    date: 'In 2024 the rent went up, and in 2026 it rose again; 3 of 4 weeks',
    phone: 'about 555 people, 3 kids and 2 adults',
    email: 'shared an @ sign on a flyer at example dot org',
    address: 'three big steps forward on Main Street',
    zip: 'about 35801 households in the county',
    ssn: 'between 12 and 45 hours a week',
    record: 'room 12, page 4, case worker visited',
  };
  for (const c of IDENTIFIER_CATEGORIES) {
    it(`${c}: flags each positive fixture`, () => {
      for (const [text, value] of POS[c]) {
        const hits = findIdentifiers(text);
        expect(hits.map((h) => [h.category, h.value]), text).toContainEqual([c, value]);
      }
    });
    it(`${c}: flags nothing in its negative fixture`, () => {
      expect(findIdentifiers(NEG[c]).map((h) => [h.category, h.value])).toEqual([]);
    });
  }
  it('a bare year is never a date', () => {
    expect(findIdentifiers('2026')).toEqual([]);
  });
});

describe('SL26 labeler', () => {
  it('is consistent: the same person gets the same label in every note; a second person the next letter', () => {
    let nb = nbWith(free('Call', 'Mr. Jones said rent is late. Jones will call.'), free('Visit', 'Visited Mr. Jones. Ms. Lee was there.'));
    const first = notebookFlags(nb).find((f) => f.value === 'Mr. Jones')!;
    const r = labelFlag(nb, first);
    expect(r.label).toBe('[Person A]');
    nb = r.notebook;
    expect(noteDocText(nb.notes[0].body)).toBe('[Person A] said rent is late. [Person A] will call.');
    expect(noteDocText(nb.notes[1].body)).toBe('Visited [Person A]. Ms. Lee was there.');
    const r2 = labelFlag(nb, notebookFlags(nb).find((f) => f.category === 'person')!);
    expect(r2.label).toBe('[Person B]');
    expect(r2.notebook.replaced).toEqual({ person: 2 });
  });
  it('stores the category and count, never the value — and the value is gone from the file', () => {
    const m = { ...newMap('Case'), notebook: nbWith(free('Call', 'Call (256) 555-0134 or write ana@example.org')) };
    const nb = labelAll(m.notebook);
    expect(notebookFlags(nb)).toEqual([]);
    expect(nb.replaced).toEqual({ phone: 1, email: 1 });
    const file = exportJSON({ ...m, notebook: nb });
    expect(file).not.toContain('555-0134');
    expect(file).not.toContain('ana@example.org');
    expect(noteDocText(nb.notes[0].body)).toBe('Call [phone] or write [email]');
  });
  it('a value split across marks is replaced, keeping the marks of its first character', () => {
    const body = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Mr. ', marks: [{ type: 'bold' }] }, { type: 'text', text: 'Jones' }, { type: 'text', text: ' came' }] }] };
    const nb = nbWith({ ...newFreeNote('x'), body: sanitizeNote(body) });
    const out = labelAll(nb);
    expect(out.notes[0].body.content[0]).toEqual({ type: 'paragraph', content: [{ type: 'text', text: '[Person A]', marks: [{ type: 'bold' }] }, { type: 'text', text: ' came' }] });
  });
  it('"Not an identifier" is remembered per notebook', () => {
    let nb = nbWith(free('x', 'Met Dr. Pepper at the store.'));
    expect(notebookFlags(nb)).toHaveLength(1);
    nb = dismissFlag(nb, 'person', 'Dr. Pepper');
    expect(notebookFlags(nb)).toEqual([]);
    nb = addNote(nb, free('y', 'Dr. Pepper again'));
    expect(notebookFlags(nb)).toEqual([]);
    expect(nb.dismissed).toEqual(['person:dr. pepper']);
  });
  it('a structured note: the date field takes a year by default; a full date is flagged and labelled', () => {
    const tpl = CORE_TEMPLATES.find((t) => t.id === 'contact')!;
    const n = newStructuredNote(tpl, '2026');
    expect(n.fields![0]).toEqual({ key: 'date', label: 'Date', value: '2026', full: false });
    let nb = nbWith(n as ReturnType<typeof free>);
    expect(notebookFlags(nb)).toEqual([]);
    nb = updateNote(nb, n.id, { fields: n.fields!.map((f) => (f.key === 'date' ? { ...f, value: '2026-03-14', full: true } : f)) });
    expect(notebookFlags(nb).map((f) => [f.where, f.category])).toEqual([['date', 'date']]);
    const out = labelAll(nb);
    expect(out.notes[0].fields![0]).toEqual({ key: 'date', label: 'Date', value: '[date]', full: false });
  });
});

describe('SL26 notes', () => {
  it('the four core templates, each starting with the date field', () => {
    expect(CORE_TEMPLATES.map((t) => t.name)).toEqual(['Intake', 'Contact note', 'Case conference', 'Plan review']);
    for (const t of CORE_TEMPLATES) expect(newStructuredNote(t).fields![0].key).toBe('date');
  });
  it('reorders, duplicates and searches by text and tag', () => {
    let nb = nbWith(free('A', 'rent'), free('B', 'food bank'), free('C', 'bus pass'));
    nb = moveNote(nb, nb.notes[2].id, 0);
    expect(nb.notes.map((n) => n.title)).toEqual(['C', 'A', 'B']);
    const d = duplicateNote(nb, nb.notes[1].id);
    expect(d.notebook.notes.map((n) => n.title)).toEqual(['C', 'A', 'A (copy)', 'B']);
    nb = updateNote(d.notebook, d.notebook.notes[3].id, { tags: ['food'] });
    expect(searchNotes(nb, 'FOOD').map((n) => n.title)).toEqual(['B']);
    expect(searchNotes(nb, '', 'food').map((n) => n.title)).toEqual(['B']);
    expect(searchNotes(nb, 'rent').map((n) => n.title)).toEqual(['A', 'A (copy)']);
  });
});
