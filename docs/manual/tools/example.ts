/**
 * The manual's worked example: "Household F", a fictional household that lost its home to a wildfire. Nothing here
 * comes from a real person; the circumstances follow a common path after a home is lost to fire.
 */
export interface N { key: string; x: number; y: number; code?: string; search?: string; status?: 'other'; type?: string; label: string; circumstance: string }
export interface E { from: string; to: string; polarity?: '+' | '−'; weight: number; description: string; override?: string; delay?: boolean }

export const NODES: N[] = [
  { key: 'fire', x: 0, y: 0, code: 'QE81', search: 'disaster', label: 'Home lost in a wildfire', circumstance: 'How much the loss of the home to the fire still shapes daily life' },
  { key: 'home', x: 434, y: 136, code: 'QD71.0', search: 'homeless', label: 'Without a home', circumstance: 'How long the household has been without a stable place to live' },
  { key: 'work', x: 0, y: 136, code: 'QD80', search: 'unemployment', label: 'Work lost after the fire', circumstance: 'How much paid work has been lost since the fire' },
  { key: 'income', x: 205, y: 248, code: 'QD51', search: 'low income', label: 'Low income', circumstance: 'How far income falls short of basic costs' },
  { key: 'food', x: 0, y: 372, code: 'QD61', search: 'food', label: 'Not enough food', circumstance: 'How often there is not enough food, or none that can be stored or cooked' },
  { key: 'stress', x: -205, y: 136, code: 'QE01', search: 'stress', label: 'Stress', circumstance: 'How much day-to-day stress the adults report' },
  { key: 'family', x: 434, y: 0, code: 'QE70.0', search: 'family support', label: 'Little family to fall back on', circumstance: 'How little help family can give: a place to stay, money, childcare' },
  { key: 'facilities', x: 434, y: 360, status: 'other', type: 'resource', label: 'No shower, laundry or kitchen', circumstance: 'How far the household is from a place to wash, do laundry and cook' },
  { key: 'priority', x: 670, y: 205, status: 'other', type: 'resource', label: 'Priority on the housing waiting list', circumstance: 'How high the household ranks on the local housing waiting list' },
  { key: 'policy', x: 670, y: 25, status: 'other', type: 'policy', label: 'Faster housing placement', circumstance: 'How quickly people displaced by disaster are placed in housing' },
];

/** links; `override` set = no evidence link in the app covers it */
export const EDGES: E[] = [
  { from: 'work', to: 'income', weight: 0.75, description: 'Pay stopped when the work was lost.', delay: false },
  { from: 'income', to: 'food', weight: 0.5, description: 'Less money for groceries.' },
  { from: 'work', to: 'stress', weight: 0.5, description: 'Losing work adds worry every day.' },
  { from: 'stress', to: 'work', weight: 0.25, description: 'Stress makes it harder to look for and keep work.' },
  { from: 'fire', to: 'home', weight: 1, description: 'The fire destroyed the home.', override: 'Disaster directly caused the loss of the home; no study in this app covers disaster → homelessness.' },
  { from: 'fire', to: 'work', weight: 0.5, description: 'The work was done from the home that burned.', override: 'Specific to this household: the workplace was the home.' },
  { from: 'home', to: 'facilities', weight: 0.75, description: 'Without a home there is nowhere to wash, do laundry or cook.', override: 'Direct consequence described by the household; not a research claim.' },
  { from: 'facilities', to: 'work', weight: 0.5, description: 'Without a shower or clean clothes, job interviews are hard to attend.', override: 'Reported by the household; no study in this app covers it.' },
  { from: 'facilities', to: 'food', weight: 0.5, description: 'No fridge or stove: food spoils or cannot be cooked.', override: 'Reported by the household; no study in this app covers it.' },
  { from: 'work', to: 'home', weight: 0.5, description: 'Without pay from work, renting again is out of reach.', override: 'The app’s evidence (L26) is about eviction (QD71.Z), not homelessness (QD71.0).' },
  { from: 'income', to: 'home', weight: 0.5, description: 'Low income keeps the household from renting again.', override: 'The app’s evidence (L02) is about eviction (QD71.Z), not homelessness (QD71.0).', delay: true },
  { from: 'family', to: 'home', weight: 0.25, description: 'No relatives with room to share.', override: 'Reported by the household.' },
  { from: 'home', to: 'priority', weight: 0.5, description: 'The longer without a home, the higher the household ranks on the list.', override: 'How the local waiting list works; not a research claim.' },
  { from: 'priority', to: 'home', polarity: '−', weight: 0.5, description: 'A higher rank brings a housing offer sooner.', override: 'How the local waiting list works; not a research claim.', delay: true },
  { from: 'policy', to: 'home', polarity: '−', weight: 0.5, description: 'Hypothesis for discussion: faster placement would shorten time without a home.', override: 'A policy idea to discuss, not an estimate.' },
];
