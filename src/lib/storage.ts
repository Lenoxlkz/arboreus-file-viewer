import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'arboreus-storage';
const FILE_STORE = 'files';
const BLOB_STORE = 'blobs';
const STATE_STORE = 'state';
const VERSION = 2; // Incremented version for new store

interface ArboreusDB {
  files: any;
  blobs: Blob;
  state: any;
}

let dbPromise: Promise<IDBPDatabase<ArboreusDB>>;

export const getDB = () => {
  if (!dbPromise) {
    dbPromise = openDB<ArboreusDB>(DB_NAME, VERSION, {
      upgrade(db, oldVersion) {
        if (!db.objectStoreNames.contains(FILE_STORE)) {
          db.createObjectStore(FILE_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(BLOB_STORE)) {
          db.createObjectStore(BLOB_STORE);
        }
        if (!db.objectStoreNames.contains(STATE_STORE)) {
          db.createObjectStore(STATE_STORE);
        }
      },
    });
  }
  return dbPromise;
};

export async function saveAppMetadata(files: any[], folders: any[]) {
  const db = await getDB();
  await db.put(STATE_STORE, files, 'files');
  await db.put(STATE_STORE, folders, 'folders');
}

export async function loadAppMetadata() {
  const db = await getDB();
  const files = (await db.get(STATE_STORE, 'files')) || [];
  const folders = (await db.get(STATE_STORE, 'folders')) || [];
  return { files, folders };
}

export async function saveFileBlob(id: string, blob: Blob) {
  const db = await getDB();
  await db.put(BLOB_STORE, blob, id);
}

export async function getFileBlob(id: string): Promise<Blob | undefined> {
  const db = await getDB();
  return db.get(BLOB_STORE, id);
}

export async function saveExtractedImages(id: string, blobs: Blob[]) {
  const db = await getDB();
  // Store them as separate entries to handle large sizes better
  await db.put(STATE_STORE, blobs.length, `${id}_count`);
  for (let i = 0; i < blobs.length; i++) {
    await db.put(BLOB_STORE, blobs[i], `${id}_page_${i}`);
  }
}

export async function getExtractedImages(id: string): Promise<Blob[]> {
  const db = await getDB();
  const count = await db.get(STATE_STORE, `${id}_count`);
  if (!count) return [];
  
  const blobs: Blob[] = [];
  for (let i = 0; i < count; i++) {
    const blob = await db.get(BLOB_STORE, `${id}_page_${i}`);
    if (blob) blobs.push(blob);
  }
  return blobs;
}

export async function deleteFileBlob(id: string) {
  const db = await getDB();
  await db.delete(BLOB_STORE, id);
  const count = await db.get(STATE_STORE, `${id}_count`);
  if (count) {
    for (let i = 0; i < count; i++) {
      await db.delete(BLOB_STORE, `${id}_page_${i}`);
    }
    await db.delete(STATE_STORE, `${id}_count`);
  }
}

export async function clearAllStorage() {
  const db = await getDB();
  await db.clear(FILE_STORE).catch(() => {});
  await db.clear(BLOB_STORE).catch(() => {});
  await db.clear(STATE_STORE).catch(() => {});
}
