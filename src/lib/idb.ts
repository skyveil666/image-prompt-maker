/**
 * Minimal promisified IndexedDB wrapper.
 *
 * DB layout (v4):
 *  - `history`          : 生成案 1 件＝1 レコード（id, dateKey, createdAt, batchId 等）
 *  - `recentImages`     : 直近で使った画像（id=ハッシュ, thumbnailDataUrl, imageDataUrl, addedAt 等）
 *  - `selectionHistory` : 選択範囲プロンプト履歴（id, createdAt, maskDataUrl, generatedPrompt 等）
 *  - `imageFeatures`    : 画像特徴DB（id=履歴アイテムID, hash=dHash16進, dominantColors, analyzedAt 等）
 *
 * 既存ユーザーは onupgradeneeded 内で oldVersion を見て段階マイグレーション。
 */

const DB_NAME = "image-prompt-maker";
const DB_VERSION = 5;

export const STORE_HISTORY   = "history";
export const STORE_RECENT    = "recentImages";
export const STORE_SELECTION = "selectionHistory";
export const STORE_IMAGE_FEATURES = "imageFeatures";
export const STORE_OPERATION_LOG = "operationLog";

type StoreName =
  | typeof STORE_HISTORY
  | typeof STORE_RECENT
  | typeof STORE_SELECTION
  | typeof STORE_IMAGE_FEATURES
  | typeof STORE_OPERATION_LOG;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = req.result;
      const oldVersion = e.oldVersion;
      if (oldVersion < 1) {
        const s = db.createObjectStore(STORE_HISTORY, { keyPath: "id" });
        s.createIndex("dateKey", "dateKey", { unique: false });
        s.createIndex("createdAt", "createdAt", { unique: false });
        s.createIndex("batchId", "batchId", { unique: false });
      }
      if (oldVersion < 2) {
        const s = db.createObjectStore(STORE_RECENT, { keyPath: "id" });
        s.createIndex("addedAt", "addedAt", { unique: false });
      }
      if (oldVersion < 3) {
        const s = db.createObjectStore(STORE_SELECTION, { keyPath: "id" });
        s.createIndex("createdAt", "createdAt", { unique: false });
      }
      if (oldVersion < 4) {
        const s = db.createObjectStore(STORE_IMAGE_FEATURES, { keyPath: "id" });
        s.createIndex("hash", "hash", { unique: false });
        s.createIndex("analyzedAt", "analyzedAt", { unique: false });
      }
      if (oldVersion < 5) {
        // skyveil好み学習エージェント：操作ログ（押したボタン・変更対象・プリセット等）
        const s = db.createObjectStore(STORE_OPERATION_LOG, { keyPath: "id" });
        s.createIndex("ts", "ts", { unique: false });
        s.createIndex("type", "type", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      // キャッシュを破棄しておくことで、次回呼び出し時にリトライできる
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
}

function awaitTx(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error);
    tx.onerror = () => reject(tx.error);
  });
}

export async function put<T extends { id: string }>(
  storeName: StoreName,
  item: T
): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(storeName, "readwrite");
  tx.objectStore(storeName).put(item);
  await awaitTx(tx);
}

export async function putMany<T extends { id: string }>(
  storeName: StoreName,
  items: T[]
): Promise<void> {
  if (items.length === 0) return;
  const db = await openDB();
  const tx = db.transaction(storeName, "readwrite");
  const store = tx.objectStore(storeName);
  for (const item of items) store.put(item);
  await awaitTx(tx);
}

export async function get<T>(storeName: StoreName, id: string): Promise<T | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const req = tx.objectStore(storeName).get(id);
    req.onsuccess = () => resolve((req.result as T | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function remove(storeName: StoreName, id: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(storeName, "readwrite");
  tx.objectStore(storeName).delete(id);
  await awaitTx(tx);
}

export async function clear(storeName: StoreName): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(storeName, "readwrite");
  tx.objectStore(storeName).clear();
  await awaitTx(tx);
}

export async function getAll<T>(storeName: StoreName): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

export async function getByIndex<T>(
  storeName: StoreName,
  indexName: string,
  value: IDBValidKey
): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const idx = tx.objectStore(storeName).index(indexName);
    const req = idx.getAll(value);
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}
