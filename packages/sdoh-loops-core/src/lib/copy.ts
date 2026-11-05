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
    /** SL24: My maps' top card, two ways in */
    start: 'Start a map',
    new: 'Create a blank map',
    name: 'Map name',
    subject: 'Subject (initials or a label)',
    create: 'Create map',
    open: 'Open',
    rename: 'Rename',
    duplicate: 'Duplicate',
    delete: 'Delete',
    deleteConfirm: 'Delete this map from this browser? This cannot be undone.',
    /** SL24 + SL23: the same wording on My maps and in the map's Map menu ("Open a map file…") */
    openFile: 'Open a map file',
    openFileHint: 'A map exported from SDOH Loops or an SDOH Interrogator app',
    dropHere: 'Drop a map file here to open it',
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
    fill: 'Fill color',
    pinned: 'Pinned in place',
    add: 'Add circumstance',
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
    colour: 'Line color',
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
  /** SL23: the Whole map card's tabs; the selection has a card of its own, and the map file actions are in the Map menu */
  panels: { loops: 'Loops', links: 'Links', paths: 'Paths', leverage: 'Leverage', pulse: 'What-if', clusters: 'Clusters', legend: 'Legend', needsCode: 'Needs a code', about: 'About this map' },
  needsCode: {
    lead: "Circumstances marked 'Not sure yet'. The evidence check can only vouch for links between coded circumstances.",
    none: 'Every circumstance has a code status',
  },
  /** SL23: the selection card's Read mode */
  read: { type: 'Type', severity: 'Severity', since: 'Since', pinned: 'Pinned in place', notPinned: 'Not pinned', thickness: 'Thickness follows |weight|' },
  /** SL31: quick field edit in Read mode */
  quick: { edit: 'Edit', saved: 'saved.', more: 'More formatting', hint: 'Enter saves, Shift+Enter starts a new line, Esc cancels.', hintLine: 'Enter saves, Esc cancels.', on: 'Yes', off: 'No' },
  /** SL23: the toolbar's Map menu */
  mapMenu: {
    button: 'Map', label: 'Map file', saved: 'Saved a copy of the map as a file.',
    save: 'Save a copy', saveDesc: 'Download this map as a .json file you can open again.',
    csv: 'Export the links (.csv)', csvDesc: 'Every link as a spreadsheet row, with its evidence.',
    md: 'Export the loop report (.md)', mdDesc: 'The loops, their strength and their links, as text.',
    png: 'Export a picture (.png)', pngDesc: 'The canvas as an image.',
    svg: 'Export a picture (.svg)', svgDesc: 'The canvas as a scalable drawing.',
    printDesc: 'Gray boxes and patterned links, for printing in black and white.',
  },
  loops: { filterAll: 'All', rename: 'Rename', arrangeCircle: 'Arrange loop as circle', clear: 'Clear highlight', byNode: 'Through circumstance', anyNode: 'Any circumstance' },
  paths: { from: 'From', to: 'To', find: 'Find paths', none: 'No path leads from the first to the second.', summary: 'Net effect' },
  leverage: { node: 'Circumstance', in: 'Weighted in', out: 'Weighted out', between: 'Betweenness', loops: 'Loops through it', sortNote: 'Sorted by the column you choose; ties by loops, then betweenness, then weighted degree.' },
  pulse: { stimulus: 'Push this circumstance', up: 'up (+1)', down: 'down (−1)', run: 'Run pulse', steps: 'steps', converged: 'settled', notConverged: 'stopped at 30 steps' },
  clusters: { lead: 'Groups of circumstances that sit inside shared feedback (strongly connected components).', none: 'No feedback clusters yet.', hulls: 'Show clusters on the canvas' },
  toolbar: {
    addNode: 'New circumstance', addEdge: 'Link to…', assoc: 'Associations', arrange: 'Auto-arrange', arrangeAll: 'Re-arrange all (ignore pins)', arrangeSel: 'Arrange selection',
    engine: 'Layout', undo: 'Undo', redo: 'Redo', hood1: '1st-degree', hood2: '2nd-degree', fit: 'Fit', listView: 'List view', canvasView: 'Canvas view', keys: 'Keyboard', more: 'More actions for the selected circumstance', moreTools: 'More', print: 'Print / grayscale',
  },
  canvas: { label: 'Map canvas. Use the arrow keys to move between circumstances, Enter to edit, A for associations, N for a new circumstance, and ? for every key.', empty: 'Double-click the canvas or press N to add the first circumstance.', emptyTouch: 'Tap New circumstance to add the first circumstance.', outline: 'Everything on the canvas' },
  exportI: { title: 'Export', json: 'Map (.json)', csv: 'Edge list (.csv)', md: 'Loop report (.md)', png: 'Picture (.png)', svg: 'Picture (.svg)', importTitle: 'Import into a new map', imported: 'Imported into a new map.' },
  /** SL26: the circumstances table shared by the list view and the notebook's case summary */
  table: { circumstance: 'Circumstance', code: 'Code and WHO title', status: 'Code status · type', description: 'Description', links: 'Links out and in', out: 'Leads to:', in: 'Comes from:' },
  list: { title: 'List view', lead: 'Everything on the canvas, as tables. Every action here works by keyboard.', nodes: 'Circumstances', edges: 'Links', edit: 'Edit', delete: 'Delete', none: 'Nothing here yet.' },
  undoNone: 'Nothing to undo.',
  /** SL17: the read-only peek (right-click, Ctrl-click or long-press on a circumstance or a link) */
  peek: {
    title: 'Quick look', close: 'Close', label: 'Label', circumstance: 'Circumstance', status: 'Code status', out: 'Links out', in: 'Links in',
    loops: 'Loops', noLoops: 'In no loop', mechanism: 'Mechanism', description: 'Description', yes: 'Yes', no: 'No', open: 'Open in editor', assoc: 'Associations…',
  },
  /** SL17: the stacked side dock and full screen */
  dock: {
    selection: { node: 'Selected circumstance', note: 'Selected canvas note', edge: 'Selected link', many: 'Selected', none: 'Nothing selected' } as Record<string, string>,
    read: 'Read', edit: 'Edit', mode: 'Read or edit the selection', wholeMap: 'Whole map', fold: 'Fold the side dock', foldTip: 'Fold the side dock (])', unfold: 'Open the side dock', unfoldTip: 'Open the side dock (])',
    resize: 'Resize the side dock', resizeTip: 'Drag, or use ← →, to resize the side dock; double-click or Home resets it', card: 'Collapse or expand', fullscreen: 'Full screen', exitFullscreen: 'Exit full screen',
  },
  /** SL26: the case manager notebook (S7.1 slice 1) */
  notebook: {
    toggle: 'Notebook', toggleTip: 'Show the notebook beside the map', autoFolded: 'The side dock is folded to make room; press ] to open it again.', tabs: 'Map or notebook', mapTab: 'Map',
    title: 'Notebook', lead: 'Notes about this case, saved inside this map. They stay on this device.',
    newFree: 'New note', newFromTemplate: 'New from a template…', untitled: 'Untitled note',
    noteTitle: 'Note title', tags: 'Tags (separate with commas)', body: 'Note text', notes: 'Notes',
    search: 'Search the notes', allTags: 'All tags', tagFilter: 'Filter by tag',
    empty: 'No notes yet. Start a free note, or pick a template.', noMatch: 'No note matches the search.',
    selectOne: 'Choose a note from the list to read and edit it.',
    free: 'Free note', structured: 'Template',
    moveUp: 'Move up', moveDown: 'Move down', reorderHint: 'Alt+↑ and Alt+↓ move the focused note; you can also drag it.',
    moved: 'Moved to position', duplicate: 'Duplicate', copy: 'copy', delete: 'Delete', deleted: 'Deleted', undo: 'Undo', dismissToast: 'Dismiss',
    dateYear: 'Year', dateFull: 'Use a full date', dateYearHint: 'A year only, by default.', dateFullHint: 'A full date can identify someone, so it is flagged.',
    check: 'Identifier check (a heuristic)', none: 'No possible identifiers', identifier: 'possible identifier',
    flagsTitle: 'Possible identifiers',
    heuristic: 'This check is a heuristic. It looks for names after Mr., Ms. or "my name is", full dates and dates of birth, ages, phone numbers, email and street addresses, cities named with their state, ZIP codes (ZIP+4, or five digits after a state), and SSN-like or record-like numbers. It does not look for names on their own: read your notes for names yourself. It can miss an identifier, and it can flag something that is not one. It never stops you typing.',
    label: 'Replace with a label', dismiss: 'Not an identifier', labelAll: 'Label them all', places: 'place',
    replaced: 'Replaced everywhere in this notebook with', replacedNote: 'The replaced text is not kept, so Undo cannot bring it back.',
    dismissedMsg: 'Marked as not an identifier in this notebook.', flagTip: 'Possible identifier — see the list in the notebook header',
    categories: { person: 'name', date: 'full date', dob: 'date of birth', age: 'age', phone: 'phone number', email: 'email address', address: 'street address', city: 'city', zip: 'ZIP code', ssn: 'SSN-like number', record: 'record-like number' } as Record<string, string>,
    print: 'Print', printTip: 'Print the notebook',
    warnTitle: 'Possible identifiers in the notebook', warnLead: 'The notebook still has', warnHint: 'Label them first, or continue as it is. The check is a heuristic, so read the notes yourself too.',
    warnLabel: 'Label them all, then continue', warnAnyway: 'Continue anyway', warnCancel: 'Cancel',
    saveDesc: 'Download this map and its notebook as a .json file you can open again.',
    saveBare: 'Save a copy without the notebook', saveBareDesc: 'The map alone, as a .json file; the notes stay on this device.',
    summary: {
      title: 'Case summary', lead: 'A live, read-only summary of the map, always at the foot of the notebook. Edit on the map or in the selection card.',
      tiles: 'The map in numbers', circumstances: 'Circumstances', links: 'Links', loops: 'Loops', flags: 'Possible identifiers',
      hiddenOne: 'hidden circumstance', hiddenMany: 'hidden circumstances', notShown: 'not shown.',
      sort: 'Sort', sortBy: { map: 'Map order', name: 'Name', code: 'Code', status: 'Code status', links: 'Most links' } as Record<string, string>,
      filter: 'Show', all: 'All circumstances', block: 'Block', leverage: 'Leverage, top 5',
    },
    resize: 'Resize the notebook', resizeTip: 'Drag, or use ← →, to resize the notebook; double-click or Home resets it',
    /** SL27: selections in notes — spans, annotations, circumstances made from text, and suggestions */
    passages: {
      bar: 'Selection actions', create: 'Create circumstance', evidence: 'Add as evidence to…', link: 'Link to…', annotate: 'Annotate', copy: 'Copy quote', copied: 'Quote copied.',
      comment: 'Comment', saveComment: 'Save comment', editComment: 'Edit comment', annotated: 'Comment saved on the selection.',
      keyHint: 'Select text, then press Ctrl+Enter (or Shift+F10) for the selection actions.',
      chooser: 'Passages here', title: 'Passages', supports: 'Supports', plain: 'A highlight only: it supports nothing on the map.', remove: 'Remove passage', removed: 'Passage removed.',
      orphaned: 'Orphaned selections', orphanedHint: 'The text these were made from was edited or deleted. They are kept here, not moved to other words.',
      inferred: 'inferred — open to your judgment', explicit: 'explicit', suggestedBy: 'suggested by:', other: 'Other',
      confidence: { high: 'high confidence', medium: 'medium confidence', low: 'low confidence' } as Record<string, string>,
      queue: 'Suggestions', engine: 'Engine', remote: 'sends text off this device', suggest: 'Suggest circumstances in this note',
      refusedRemote: 'This engine sends text off the device, and this app does not allow that.', refusedFlags: 'This note still has possible identifiers. Label or dismiss them first.',
      failed: 'The suggestions could not be made.', none: 'No suggestions for this note.', accept: 'Accept', editAccept: 'Edit then accept', reject: 'Reject',
      suggestedTitle: 'Suggested codes', suggestedTag: 'suggested', suggestHint: 'Matched on this device against WHO titles, index terms and search aliases. Nothing is chosen for you.', noSuggestion: 'No code matched these words.',
      notSure: 'Not sure yet', otherOpt: 'Other (not an SDOH code)', searchAll: 'Search all codes', pickFirst: 'Choose a code, Not sure yet or Other first.', fromText: 'From the notebook:',
      evidenceTitle: 'Add as evidence to…', evidenceSearch: 'Search circumstances and links', evidenceNodes: 'Circumstances', evidenceEdges: 'Links', evidenceNone: 'Nothing on the map matches.', evidenceAdded: 'Added the passage as evidence to',
      deleteTitle: 'Delete and its passages', deleteLead: 'passages in the notebook support what you are deleting.', deleteKeep: 'Keep them as plain highlights', deleteRemove: 'Remove them', deleteCancel: 'Cancel',
      readRow: 'Passages', byRow: 'Suggested by', inNote: 'in',
      inNotebook: 'In the notebook', goTo: 'Go to passage', removeEvidence: 'Remove as evidence', removedEvidence: 'Removed as evidence from',
    },
    /** SL29: importing files as notes */
    importing: {
      button: 'Import a file…', buttonTip: 'Text, Markdown, Word, PDF, web page, RTF or CSV files, read on this device',
      paste: 'Paste as a note', menu: 'Import into the notebook…', menuHint: 'Text, Word, PDF and other files, read on this device',
      drop: 'Drop files here to import them as notes',
      title: 'Import into the notebook', reading: 'Reading', ready: 'Read', failed: 'Not imported',
      original: 'The original file is not kept: only the text shown here is saved, in this browser. Keep the original wherever it already lives. Its author, title and other properties are not read.',
      reviewOf: 'of', noneFound: 'No possible identifiers found.',
      labelAll: 'Label all', oneByOne: 'Review one by one', keep: 'Keep as is', save: 'Save the note', skip: 'Skip this file',
      keepConfirm: 'Keep these as they are? They are saved in this browser and go into every export, which warns first.', keepYes: 'Yes, keep as is', back: 'Back',
      flagN: 'Possible identifier', saved: 'Saved to the notebook:', skipped: 'Skipped:', done: 'Done', close: 'Close',
      pasteTitle: 'Paste as a note', pasteLabel: 'Text', pasteName: 'Title', pasteGo: 'Review and save', pasteDefault: 'Pasted text',
      later: 'Reading scanned pages (OCR) may come later.',
      droppedOne: 'character could not be read and was left out.', droppedMany: 'characters could not be read and were left out.',
      source: 'Imported from', review: { none: 'no possible identifiers found', labelled: 'identifiers labeled before saving', reviewed: 'identifiers reviewed one by one before saving', kept: 'kept as is' } as Record<string, string>,
      verbatim: 'Imported text stays as it was read. Its title and tags can change, and labels still replace identifiers.',
      text: 'Imported text', table: 'Imported table', kind: 'Imported',
    },
    help: {
      title: 'The notebook',
      what: 'The notebook sits beside the map. Use it for notes about the case: free notes with headings and lists, or notes from a template (Intake, Contact note, Case conference, Plan review), each with headed fields. Search finds words in any note, and tags group them.',
      device: 'Notes are saved inside the map, in this browser, as you type. Nothing is sent anywhere. They leave this device only when you export the map, and "Clear my data" deletes them with everything else. Export saves the notes with the map; "Save a copy without the notebook" leaves them out.',
      check: 'As you type, the identifier check underlines things that may identify someone: names after Mr., Ms., Dr. or "my name is", full dates and dates of birth (after "DOB" or "born on"), ages ("34-year-old", "age 34"), phone numbers, email and street addresses, cities named with their state ("Huntsville, AL"; a state alone is not flagged), ZIP codes (ZIP+4, or five digits after a state or a city and state), and SSN-like or record-like numbers. "Replace with a label" changes every copy in the notebook to a label such as [Person A] or [phone]; the same person keeps the same letter. Only the kind and the number of replacements are kept, never the text. Every export and Print warns while flags remain.',
      importing: 'Import a file… reads text, Markdown, Word (.docx), PDF (its text layer), web page, RTF and CSV files on this device: nothing is uploaded. Each file becomes a note once the identifier check has run over it, and you choose to label what it found, go through it one by one, or keep it as is. The original file is not kept, and its author and title are not read. A scanned PDF has no text to read yet.',
      cannot: 'It is a heuristic, not a guarantee. It does not look for names that have no title (Mr., Ms., Dr.) and no "my name is" before them: those cannot be told apart from other capitalized words, so read your notes for names yourself. It also cannot catch a first name on its own, a nickname, a place or employer, a rare detail that points to one person, or a name spelled in lower case, and it may flag something harmless; mark that "Not an identifier". A year on its own is never flagged. A name labeled earlier is not recognized if it is typed again after a reload. Read the notes before you share them.',
    },
  },
  /** SL17 review 2: the layout picker, in plain words; the engine ids in the map file are unchanged */
  layoutPick: {
    label: 'Layout', fcose: 'Clustered', 'elk-stress': 'Evenly spaced',
    fcoseTip: 'Linked circumstances pull together, so groups and loops stand out.',
    'elk-stressTip': 'Distance on screen follows distance in links.',
  } as Record<string, string>,
  nodeText: { label: 'Node text', title: 'Title', 'title-code': 'Title + code', full: 'Full' } as Record<string, string>,
  /** SL17: keys added in this release; the pack's own list (keys) shows first */
  keysMore: [['E', 'read / edit the selection'], ['K', 'new link from the selection'], ['⌘O / ⌘S', 'open a map file / save a copy'], ['F', 'full screen (Esc leaves)'], [']', 'fold / open the side dock'], ['Shift+F10 / Menu', 'quick look at the selection']] as [string, string][],
  keys: [
    ['N', 'new circumstance'], ['E', 'new link from the selection'], ['A', 'association menu'], ['1 / 2', '1st / 2nd-degree neighborhood'], ['L', 'loops panel'],
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

const merged = overlay(overlay(FALLBACK, S), (S as { app?: unknown }).app);

/**
 * SL23: the interface is in US English. The pinned pack 0.1.1 still carries a few British UI strings under `app:`;
 * these win over it until the pack's own strings change. WHO's titles and definitions are never touched (not copy).
 */
const US: [RegExp, string][] = [
  [/\bcolour/g, 'color'], [/\bColour/g, 'Color'], [/greyscale/g, 'grayscale'], [/Greyscale/g, 'Grayscale'], [/neighbourhood/g, 'neighborhood'],
  [/\banalyse/g, 'analyze'], [/\bAnalyse/g, 'Analyze'], [/organis/g, 'organiz'], [/recognis/g, 'recogniz'], [/\bcentre/g, 'center'], [/\bcentred/g, 'centered'],
];
function us<T>(v: T): T {
  if (typeof v === 'string') return US.reduce((t, [re, to]) => t.replace(re, to), v as string) as T;
  if (Array.isArray(v)) return v.map(us) as T;
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, us(x)])) as T;
  return v;
}
// SL23: E toggles Read / Edit; "new link from the selection" moves to K (the pack's key list still says E)
merged.keys = merged.keys.filter(([k]) => k !== 'E');
// SL24: My maps' blank-map heading sits beside "Open a map file" now (the pack still says "New map")
merged.maps.new = FALLBACK.maps.new;
export const C = us(merged);

