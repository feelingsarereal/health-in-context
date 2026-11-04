/**
 * Interface copy (ACTION-SPEC §5). The pack's content-pack/ui-strings.yaml is the source: any key it defines at the
 * same path as below (top level, or under an `app:` namespace) replaces the fallback here, string for string and list
 * for list. The fallbacks keep the app whole until Cowork has moved every string into the pack (K2 item 3).
 * No facts live here — only labels, instructions and empty states. Every string is linted (tests/safety).
 */
import { S } from './data/core';

const FALLBACK = {
  nav: { map: 'Map', maps: 'My maps', evidence: 'Evidence', references: 'References', glossary: 'Glossary', concepts: 'Primers', help: 'Help', methods: 'Methods', about: 'About' },
  footer: 'SDOH Loops is a thinking tool. Maps stay in this browser.',
  skip: 'Skip to main content',
  theme: { dark: 'Dark mode', light: 'Light mode' },
  /** K14: /about keeps the notice's words (SAFETY H5) as a plain section, so the dismissed first-run banner never comes back there */
  notice: { plainTitle: 'What this tool is and is not' },
  maps: {
    title: 'My maps',
    lead: 'Each map is saved in this browser as you work.',
    empty: 'No maps on this device yet.',
    new: 'New map',
    name: 'Map name',
    subject: 'Subject (initials or a label)',
    create: 'Create map',
    open: 'Open',
    rename: 'Rename',
    duplicate: 'Duplicate',
    delete: 'Delete',
    deleteConfirm: 'Delete this map from this browser? This cannot be undone.',
    import: 'Import a map (.json or .csv)',
  },
  node: {
    variableHint: "Read this box as 'how much of this is present'.",
    status: 'Code status',
    code: 'ICD-11 code',
    chooseCode: 'Choose a code',
    changeCode: 'Change code',
    type: 'Type (optional)',
    ref: 'Your own reference (optional, e.g. a code from another chapter)',
    userEntered: 'user-entered',
    label: 'Short label (optional)',
    circumstance: 'Describe the circumstance',
    severity: 'Severity (optional, 0–3)',
    since: 'Since (optional)',
    notes: 'Notes',
    fill: 'Fill colour',
    pinned: 'Pinned in place',
    add: 'Add circumstance',
    toCode: 'To code',
    toCodeEmpty: 'Every circumstance has a code status other than "Not sure yet".',
    note: 'Canvas note',
    addNote: 'Add a canvas note',
  },
  edge: {
    from: 'From',
    to: 'To',
    polarity: 'Polarity',
    weight: 'Weight',
    delay: 'Delay (drawn as ‖)',
    confidence: 'Your confidence',
    description: 'Describe how one leads to the other',
    line: 'Line',
    route: 'Route',
    colour: 'Line colour',
    thickness: 'Thickness follows |weight|',
    add: 'Add link',
    evidence: 'Evidence',
    userDrawn: 'No citation — you drew this link.',
    ambiguity: 'Two links between the same pair have different polarity. The methods for this app recommend splitting the circumstance into two instead.',
  },
  evidence: {
    supported: 'Backed by evidence:',
    notSupported: 'Not backed by evidence in this app',
    nearest: 'Nearest supported links',
    usePolarity: 'Use the supported polarity',
    overrideTitle: 'Keep it as an override',
    overrideConfirm: 'I want this link on the map anyway. It will be flagged ⚑ as an override.',
    overrideReason: 'Why keep this link?',
    saveOverride: 'Save as override',
    cannotSave: 'This link cannot be saved until you confirm the override and give a reason.',
    searchNodes: 'Search the circumstances on this map',
    alreadyLinked: 'These two are already linked in this direction; this adds a second link.',
    basis: 'Basis',
    basisLabel: { evidence: 'evidence', override: 'override ⚑', 'needs-review': 'needs review ⚑' } as Record<string, string>,
    confirmedOn: 'confirmed',
    useEvidence: 'Back it with evidence link',
    reviewLead: 'A recode or an edit means this link is no longer backed by evidence. Confirm it as an override with a reason, or delete it.',
    toggle: 'Evidence-backed links only',
    toggleOnNone: 'No loop is closed by evidence alone. With the links in this app, none can be: every loop needs at least one override. Turn the toggle off to see them.',
    toggleOnNoneMaybe: 'No loop on this map is closed by evidence alone. Turn the toggle off to see loops that rely on overrides.',
    legend: 'Override: not backed by evidence in this app',
    legendReview: 'Needs review: lost its evidence after a recode or an edit',
    toReview: 'Links to review',
    linkTo: 'Link to…',
    linkExisting: 'Link to',
    connect: 'Drag to another circumstance to link them',
  },
  assoc: {
    open: 'Associations',
    follow: 'Add new',
    yourOwn: 'Add a new circumstance and link it yourself',
    suggested: 'Suggested codes',
    inBlock: 'Or choose any code in this block',
    none: 'No evidence-graded links in this pack start or end here.',
    noneOut: 'None start here.',
    noneIn: 'None end here.',
    hideSecond: 'Hide 2nd-degree',
  },
  panels: { inspect: 'Selected', loops: 'Loops', links: 'Links', paths: 'Paths', leverage: 'Leverage', pulse: 'What-if', tocode: 'To code', clusters: 'Clusters', legend: 'Legend', map: 'Map & export' },
  loops: { filterAll: 'All', rename: 'Rename', arrangeCircle: 'Arrange loop as circle', clear: 'Clear highlight', byNode: 'Through circumstance', anyNode: 'Any circumstance' },
  paths: { from: 'From', to: 'To', find: 'Find paths', none: 'No path leads from the first to the second.', summary: 'Net effect' },
  leverage: { node: 'Circumstance', in: 'Weighted in', out: 'Weighted out', between: 'Betweenness', loops: 'Loops through it', sortNote: 'Sorted by the column you choose; ties by loops, then betweenness, then weighted degree.' },
  pulse: { stimulus: 'Push this circumstance', up: 'up (+1)', down: 'down (−1)', run: 'Run pulse', steps: 'steps', converged: 'settled', notConverged: 'stopped at 30 steps' },
  clusters: { lead: 'Groups of circumstances that sit inside shared feedback (strongly connected components).', none: 'No feedback clusters yet.', hulls: 'Show clusters on the canvas' },
  toolbar: {
    addNode: 'New circumstance', addEdge: 'Link to…', assoc: 'Associations', arrange: 'Auto-arrange', arrangeAll: 'Re-arrange all (ignore pins)', arrangeSel: 'Arrange selection',
    engine: 'Layout', undo: 'Undo', redo: 'Redo', hood1: '1st-degree', hood2: '2nd-degree', fit: 'Fit', listView: 'List view', canvasView: 'Canvas view', keys: 'Keyboard', more: 'More actions for the selected circumstance', moreTools: 'More', print: 'Print / greyscale',
  },
  canvas: { label: 'Map canvas. Use the arrow keys to move between circumstances, Enter to edit, A for associations, N for a new circumstance, and ? for every key.', empty: 'Double-click the canvas or press N to add the first circumstance.', emptyTouch: 'Tap New circumstance to add the first circumstance.', outline: 'Everything on the canvas' },
  exportI: { title: 'Export', json: 'Map (.json)', csv: 'Edge list (.csv)', md: 'Loop report (.md)', png: 'Picture (.png)', svg: 'Picture (.svg)', importTitle: 'Import into a new map', imported: 'Imported into a new map.' },
  list: { title: 'List view', lead: 'Everything on the canvas, as tables. Every action here works by keyboard.', nodes: 'Circumstances', edges: 'Links', edit: 'Edit', delete: 'Delete', none: 'Nothing here yet.' },
  undoNone: 'Nothing to undo.',
  /** SL17: the read-only peek (right-click, Ctrl-click or long-press on a circumstance or a link) */
  peek: {
    title: 'Quick look', close: 'Close', label: 'Label', circumstance: 'Circumstance', status: 'Code status', out: 'Links out', in: 'Links in',
    loops: 'Loops', noLoops: 'In no loop', mechanism: 'Mechanism', description: 'Description', yes: 'Yes', no: 'No', open: 'Open in editor', assoc: 'Associations…',
  },
  /** SL17: the stacked side dock and full screen */
  dock: { editor: 'Editor', collapse: 'Hide the side panels', expand: 'Show the side panels', card: 'Collapse or expand', fullscreen: 'Full screen', exitFullscreen: 'Exit full screen' },
  nodeText: { label: 'Node text', title: 'Title', 'title-code': 'Title + code', full: 'Full' } as Record<string, string>,
  /** SL17: keys added in this release; the pack's own list (keys) shows first */
  keysMore: [['F', 'full screen (Esc leaves)'], [']', 'hide / show the side panels'], ['Shift+F10 / Menu', 'quick look at the selection']] as [string, string][],
  keys: [
    ['N', 'new circumstance'], ['E', 'new link from the selection'], ['A', 'association menu'], ['1 / 2', '1st / 2nd-degree neighbourhood'], ['L', 'loops panel'],
    ['R', 'auto-arrange'], ['P', 'pin / unpin'], ['Del', 'delete'], ['⌘Z / ⌘⇧Z', 'undo / redo'], ['⌘B / ⌘I / ⌘U', 'bold / italic / underline while editing text'],
    ['← → ↑ ↓', 'move between circumstances'], ['Shift + arrows', 'nudge the selected circumstance (pins it)'], ['Enter', 'edit the selection'], ['Esc', 'clear the selection'], ['?', 'this list'],
  ] as [string, string][],
  tierExplain: {
    seminal: 'The works that defined the field; read oldest first so its history runs forward.',
    classic: 'Long-standing studies the field still leans on.',
    current: 'Recent work, newest first.',
    background: 'Methods and sources this app relies on.',
  } as Record<string, string>,
  ref: { abstract: 'Abstract, verbatim', summary: 'Summary', notVerified: 'not verified', noAbstract: 'No abstract harvested', usedBy: 'Used by', why: 'Why it mattered', open: 'Open the source' },
};

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };
/** Pack values win where the shape matches; anything else keeps the fallback. */
export function overlay<T>(base: T, over: unknown): T {
  if (over === undefined || over === null) return base;
  if (typeof base === 'string') return (typeof over === 'string' ? over : base) as T;
  if (Array.isArray(base)) return (Array.isArray(over) && over.length ? over : base) as T;
  if (base && typeof base === 'object' && typeof over === 'object' && !Array.isArray(over)) {
    const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
    for (const k of Object.keys(out)) out[k] = overlay(out[k], (over as Record<string, Json>)[k]);
    return out as T;
  }
  return base;
}

export const C = overlay(overlay(FALLBACK, S), (S as { app?: unknown }).app);

