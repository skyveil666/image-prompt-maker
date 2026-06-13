/**
 * Minimal promisified IndexedDB wrapper.
 *
 * DB layout (v7):
 *  - `history`          : 生成案 1 件＝1 レコード（id, dateKey, createdAt, batchId 等）
 *  - `recentImages`     : 直近で使った画像（id=ハッシュ, thumbnailDataUrl, imageDataUrl, addedAt 等）
 *  - `selectionHistory` : 選択範囲プロンプト履歴（id, createdAt, maskDataUrl, generatedPrompt 等）
 *  - `imageFeatures`    : 画像特徴DB（id=履歴アイテムID, hash=dHash16進, dominantColors, analyzedAt 等）
 *  - `operationLog`     : skyveil好み学習の操作ログ（id, ts, type, detail）
 *  - `referenceRecords` : Reference Picker / Compare Mode の参照レコード（id, createdAt, refThumb, extracted, applied, batchId）
 *
 * migration 方針（v7〜）：onupgradeneeded で **objectStoreNames.contains() による「無ければ作成」の冪等 migration**。
 * createObjectStore は追加のみ＝既存ストア・既存データは破壊しない（clear/deleteDatabase は使わない）。
 * version-gate ではなく存在判定にすることで、過去に不完全なバージョン（例：HMR中に DB_VERSION だけ上がり
 * referenceRecords が作られなかった）で固定化された DB も、ストア欠落を安全に自己修復する。
 * ※ DB_VERSION を上げるのは「既存DBで onupgradeneeded を発火させ、欠落ストアを補う」ため。
 */

const DB_NAME = "image-prompt-maker";
const DB_VERSION = 7;

export const STORE_HISTORY   = "history";
export const STORE_RECENT    = "recentImages";
export const STORE_SELECTION = "selectionHistory";
export const STORE_IMAGE_FEATURES = "imageFeatures";
export const STORE_OPERATION_LOG = "operationLog";
export const STORE_REFERENCE_RECORDS = "referenceRecords";

type StoreName =
  | typeof STORE_HISTORY
  | typeof STORE_RECENT
  | typeof STORE_SELECTION
  | typeof STORE_IMAGE_FEATURES
  | typeof STORE_OPERATION_LOG
  | typeof STORE_REFERENCE_RECORDS;

let dbPromise: Promise<IDBDatabase> | null = null;

/** 期待するストア一覧（自己修復の欠落判定に使用）。 */
const EXPECTED_STORES: readonly string[] = [
  STORE_HISTORY, STORE_RECENT, STORE_SELECTION,
  STORE_IMAGE_FEATURES, STORE_OPERATION_LOG, STORE_REFERENCE_RECORDS,
];

/**
 * 冪等にストアを作成（存在しなければ作成）。createObjectStore は追加のみ＝既存ストア・既存データ非破壊。
 * onupgradeneeded 内からのみ呼ぶ（versionchange トランザクション中）。
 */
function ensureStores(db: IDBDatabase): void {
  if (!db.objectStoreNames.contains(STORE_HISTORY)) {
    const s = db.createObjectStore(STORE_HISTORY, { keyPath: "id" });
    s.createIndex("dateKey", "dateKey", { unique: false });
    s.createIndex("createdAt", "createdAt", { unique: false });
    s.createIndex("batchId", "batchId", { unique: false });
  }
  if (!db.objectStoreNames.contains(STORE_RECENT)) {
    const s = db.createObjectStore(STORE_RECENT, { keyPath: "id" });
    s.createIndex("addedAt", "addedAt", { unique: false });
  }
  if (!db.objectStoreNames.contains(STORE_SELECTION)) {
    const s = db.createObjectStore(STORE_SELECTION, { keyPath: "id" });
    s.createIndex("createdAt", "createdAt", { unique: false });
  }
  if (!db.objectStoreNames.contains(STORE_IMAGE_FEATURES)) {
    const s = db.createObjectStore(STORE_IMAGE_FEATURES, { keyPath: "id" });
    s.createIndex("hash", "hash", { unique: false });
    s.createIndex("analyzedAt", "analyzedAt", { unique: false });
  }
  if (!db.objectStoreNames.contains(STORE_OPERATION_LOG)) {
    // skyveil好み学習エージェント：操作ログ（押したボタン・変更対象・プリセット等）
    const s = db.createObjectStore(STORE_OPERATION_LOG, { keyPath: "id" });
    s.createIndex("ts", "ts", { unique: false });
    s.createIndex("type", "type", { unique: false });
  }
  if (!db.objectStoreNames.contains(STORE_REFERENCE_RECORDS)) {
    // Reference Picker / Compare Mode：参照レコード（参照サムネ＋抽出＋適用→batchIdで生成へ紐付）
    const s = db.createObjectStore(STORE_REFERENCE_RECORDS, { keyPath: "id" });
    s.createIndex("batchId", "batchId", { unique: false });
    s.createIndex("createdAt", "createdAt", { unique: false });
  }
}

/** 1 回の open。version 未指定なら「現状確認用」（既存versionをそのまま開き upgrade しない）。 */
function openRaw(version?: number): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = version === undefined ? indexedDB.open(DB_NAME) : indexedDB.open(DB_NAME, version);
    req.onupgradeneeded = () => ensureStores(req.result);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    // BUG-8: 別タブが旧versionで開いたままだと blocked。永久ハングを防ぐため reject。
    req.onblocked = () => reject(new Error(
      "IndexedDB の更新がブロックされました（別タブが古いバージョンで開いています）。" +
      "他のタブを閉じてから再読み込みしてください。"
    ));
  });
}

/**
 * DB を開く（自己修復つき）。
 * version 依存の段階migrationは廃し、「現状を覗いて必要ストアが欠けていれば onupgradeneeded を
 * 強制発火して補完する」方式。これにより、過去の不完全アップグレードで『現行versionなのにストア欠落』
 * という状態に固定化された DB も、データを壊さず確実に修復する（version は floor として扱う）。
 */
function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = (async () => {
    try {
      // 1) 現状確認（upgrade を起こさず existing version とストアを読む）。
      const peek = await openRaw(undefined);
      const existingVersion = peek.version;
      const missing = EXPECTED_STORES.some((s) => !peek.objectStoreNames.contains(s));
      peek.close();
      // 2) 目標version：最低 DB_VERSION。現行versionで既にストア欠落なら +1 して onupgradeneeded を強制。
      let target = Math.max(DB_VERSION, existingVersion);
      if (missing && existingVersion >= target) target = existingVersion + 1;
      // 3) target で開く（必要なら onupgradeneeded → ensureStores が欠落ストアを作成）。
      const db = await openRaw(target);
      // BUG-8: 別タブがアップグレードを要求したら自タブ接続を閉じてブロック源にならない。
      db.onversionchange = () => { db.close(); dbPromise = null; };
      return db;
    } catch (err) {
      dbPromise = null; // 次回呼び出しでリトライ可能に
      throw err;
    }
  })();
  return dbPromise;
}

function awaitTx(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error);
    tx.onerror = () => reject(tx.error);
  });
}

export class StorageQuotaError extends Error {
  constructor() {
    super("QuotaExceeded");
    this.name = "StorageQuotaError";
  }
}

function rethrowQuota(err: unknown): never {
  if (err instanceof DOMException && err.name === "QuotaExceededError") {
    throw new StorageQuotaError();
  }
  throw err;
}

export async function put<T extends { id: string }>(
  storeName: StoreName,
  item: T
): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(storeName, "readwrite");
  tx.objectStore(storeName).put(item);
  try {
    await awaitTx(tx);
  } catch (err) {
    rethrowQuota(err);
  }
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
  try {
    await awaitTx(tx);
  } catch (err) {
    rethrowQuota(err);
  }
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

/**
 * get + put を同一 readwrite トランザクション内で実行する（ロストアップデート防止）。
 * transform が null を返した場合は put をスキップして null を返す。
 */
export async function updateAtomic<T extends { id: string }>(
  storeName: StoreName,
  id: string,
  transform: (current: T | null) => T | null,
): Promise<T | null> {
  const db = await openDB();
  return new Promise<T | null>((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const current = (getReq.result as T | undefined) ?? null;
      const next = transform(current);
      if (next === null) { resolve(null); return; }
      const putReq = store.put(next);
      putReq.onsuccess = () => resolve(next);
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
    tx.onerror = () => reject(tx.error);
  });
}
