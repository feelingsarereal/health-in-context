/** SL26: the notebook model — schema 3 migration both ways, the identifier patterns, the labeler. */
import { describe, expect, it } from 'vitest';
import { migrate, newMap, SCHEMA_VERSION, withoutNotebook, ImportError } from '../../packages/sdoh-loops-core/src/lib/model/map';
import { exportJSON, importJSON } from '../../packages/sdoh-loops-core/src/lib/model/interchange';
import { docFromText } from '../../packages/sdoh-loops-core/src/lib/model/rich';
import { findIdentifiers, IDENTIFIER_CATEGORIES, type IdentifierCategory } from '../../packages/sdoh-loops-core/src/lib/model/identifiers';
import {
  addNote, CORE_TEMPLATES, dismissFlag, duplicateNote, labelAll, labelFlag, moveNote, newFreeNote, newStructuredNote, notebookFlags, noteDocText, sanitizeNote, sanitizeNotebook, searchNotes, updateNote, type Notebook,
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
    dob: [['DOB 03/14/1961 on the form', '03/14/1961'], ['She was born on March 14, 1961.', 'March 14, 1961']],
    age: [['a 34-year-old mother', '34-year-old'], ['age 34 at intake', 'age 34'], ['aged 34, she', 'aged 34']],
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
    dob: 'born in 1961; the DOB field was blank',
    age: 'for 5 years, on page 34, a 3-year lease',
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

describe('SL30 dates: each format the item names, positive and negative, at a sentence end too; labelled [date]', () => {
  const POS: [string, string][] = [
    // MM/DD/YYYY — the walkthrough's miss: a numeric date before a period
    ['Spoke with Mrs. Jane Doe on 03/14/2026.', '03/14/2026'],
    ['Spoke with Mrs. Jane Doe on 03/14/2026...', '03/14/2026'],
    ['Spoke with Mrs. Jane Doe on 03/14/2026 … she called', '03/14/2026'],
    ['seen 03/14/2026, then', '03/14/2026'],
    // M/D/YY
    ['moved out 3/4/26.', '3/4/26'],
    ['moved out 3/4/26 and', '3/4/26'],
    // DD-MM-YYYY
    ['letter dated 14-03-2026.', '14-03-2026'],
    ['letter dated 14.03.2026 from', '14.03.2026'],
    // YYYY-MM-DD
    ['notice 2026-03-14.', '2026-03-14'],
    ['notice 2026/03/14 from', '2026/03/14'],
    // Month D, YYYY
    ['since March 14, 2026.', 'March 14, 2026'],
    ['since Mar. 4, 2026 the', 'Mar. 4, 2026'],
    // D Month YYYY
    ['since 14 March 2026.', '14 March 2026'],
    ['since 4 Sept 2026 the', '4 Sept 2026'],
    // Month D without a year
    ['court on March 14.', 'March 14'],
    ['court on Dec 3rd, then', 'Dec 3rd'],
  ];
  const NEG = ['in 2026', 'In 2026.', '3/4 of the rent', '1/2 cup', 'about 1/2 cup of rice.', 'paid 3/4 of it in 2026.', 'may 5 people come', 'grade 10.5 reading level', 'version 1.2.'];
  for (const [text, value] of POS)
    it(`flags "${value}" in "${text}"`, () => {
      expect(findIdentifiers(text).map((h) => [h.category, h.value])).toContainEqual(['date', value]);
    });
  for (const text of NEG)
    it(`flags no date in "${text}"`, () => {
      expect(findIdentifiers(text).filter((h) => h.category === 'date')).toEqual([]);
    });
  it('the walkthrough sentence: every category flagged, and Label them all leaves [date] where the date was', () => {
    const nb = nbWith(free('Visit', 'Spoke with Mrs. Jane Doe on 03/14/2026. Call (256) 555-0142, jane.doe@example.com, 1420 Oak Street, MRN 00482913.'));
    expect(notebookFlags(nb).map((f) => f.category)).toEqual(['person', 'date', 'phone', 'email', 'address', 'record']);
    const out = labelAll(nb);
    expect(noteDocText(out.notes[0].body)).toBe('Spoke with [Person A] on [date]. Call [phone], [email], [address], [record no.].');
    expect(JSON.stringify(out)).not.toContain('03/14/2026');
  });
  it('a notebook saved before the fix is checked again when it loads: its dates are flagged', () => {
    const saved = JSON.parse(JSON.stringify(nbWith(free('Old', 'Rent was due on 03/14/2026.'))));
    expect(notebookFlags(sanitizeNotebook(saved)).map((f) => [f.category, f.value])).toEqual([['date', '03/14/2026']]);
  });
});

describe('SL31 identifier gaps: ZIP next to a state, ages, dates of birth — positive and negative fixtures', () => {
  const POS: [string, IdentifierCategory, string][] = [
    ['lives in Huntsville, AL 35801 now', 'zip', '35801'],
    ['Huntsville, Alabama 35801.', 'zip', '35801'],
    ['moved to New York 10012', 'zip', '10012'],
    ['AL 35801-1234', 'zip', '35801-1234'],
    ['a 34-year-old mother', 'age', '34-year-old'],
    ['she is 34 years old', 'age', '34 years old'],
    ['34 y/o, two kids', 'age', '34 y/o'],
    ['age 34 at intake', 'age', 'age 34'],
    ['Age: 7', 'age', 'Age: 7'],
    ['aged 34, she said', 'age', 'aged 34'],
    ['34 years of age', 'age', '34 years of age'],
    ['DOB 03/14/1961.', 'dob', '03/14/1961'],
    ['DOB: 3/14/61', 'dob', '3/14/61'],
    ['D.O.B. 1961-03-14', 'dob', '1961-03-14'],
    ['born on March 14, 1961', 'dob', 'March 14, 1961'],
    ['Date of birth 14 March 1961', 'dob', '14 March 1961'],
  ];
  const NEG = ['5 years', 'for 5 years now', 'the 10012 form', 'about 35801 households', 'on page 34', 'a 3-year lease', 'born in 1961', 'the DOB field', 'stage 4 of the process', 'average 34 hours'];
  for (const [text, c, value] of POS)
    it(`${c}: "${value}" in "${text}"`, () => {
      expect(findIdentifiers(text).map((h) => [h.category, h.value])).toContainEqual([c, value]);
    });
  for (const text of NEG)
    it(`nothing in "${text}"`, () => {
      expect(findIdentifiers(text).filter((h) => ['zip', 'age', 'dob'].includes(h.category))).toEqual([]);
    });
  it('labels: [ZIP code], [age], [date of birth]; the lead words stay', () => {
    const nb = nbWith(free('Intake', 'A 34-year-old mother, DOB 03/14/1991, of Huntsville, AL 35801.'));
    expect(notebookFlags(nb).map((f) => f.category)).toEqual(['age', 'dob', 'zip']);
    expect(noteDocText(labelAll(nb).notes[0].body)).toBe('A [age] mother, DOB [date of birth], of Huntsville, AL [ZIP code].');
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
