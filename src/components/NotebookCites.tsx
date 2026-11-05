import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useHref } from 'react-router-dom';
import { getStore, NotebookCitations, type MapStore } from '@feelingsarereal/sdoh-loops-core';

/**
 * SL28: the References, Glossary and 101 pages show "Cited in your notebook (n)" — the passages in every map's notebook
 * on this device that cite the item, each a link that opens its map at the passage. Read from this browser's store only.
 */
export default function NotebookCites({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<MapStore | null>(null);
  useEffect(() => {
    getStore().then(setStore);
  }, []);
  const base = useHref('/map');
  const href = useCallback((map: string, span: string) => `${base}?id=${encodeURIComponent(map)}&passage=${encodeURIComponent(span)}`, [base]);
  return <NotebookCitations store={store} href={href}>{children}</NotebookCitations>;
}
