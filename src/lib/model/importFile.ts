import { codeMap } from '@/lib/data/scheme';
import { getStore } from '@/lib/storage';
import { importCSV, importJSON } from './interchange';
import { newId, type SdohMap } from './map';

/** Import a .json map or a .csv edge list into a NEW map on this device (the original id is never overwritten). */
export async function importFile(file: File): Promise<SdohMap> {
  const text = await file.text();
  const base = file.name.replace(/\.(sdohmap\.)?(json|csv)$/i, '');
  const csv = /\.csv$/i.test(file.name);
  const m = csv ? importCSV(text, base, (c) => codeMap.has(c)) : importJSON(text);
  const fresh: SdohMap = { ...m, id: newId('map'), name: csv ? base : `${m.name} (imported)`, updated: new Date().toISOString() };
  const store = await getStore();
  await store.save(fresh);
  return fresh;
}
