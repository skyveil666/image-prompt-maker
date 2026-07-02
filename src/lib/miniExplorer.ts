/**
 * Mini Explorer — File System Access API helpers + IndexedDB persistence.
 *
 * Architecture notes:
 * - Folder handles are stored in a dedicated DB so they survive page reloads
 *   (Chrome/Edge prompt for re-permission on the first access after reload).
 * - Object URLs (URL.createObjectURL) are used for in-memory display only;
 *   they must be revoked when no longer needed.
 * - For favorites, we store compressed JPEG data URLs so they survive
 *   beyond the current directory-handle session.
 * - Designed so migrating to Electron/Tauri is easy: replace FSA calls with
 *   Node fs / Tauri fs plugin calls.
 */

const DB_NAME = "miniExplorerDB";
const DB_VERSION = 1;
const STORE_FOLDERS = "exFolders";
const STORE_FAVORITES = "exFavs";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_FOLDERS)) {
        db.createObjectStore(STORE_FOLDERS); // keyed by tab id
      }
      if (!db.objectStoreNames.contains(STORE_FAVORITES)) {
        db.createObjectStore(STORE_FAVORITES, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export type ExplorerTabId = "all" | "bg" | "pose" | "hair" | "outfit" | "fav";

/** Tabs that can have an assigned folder (excludes "all" and "fav") */
export const FOLDER_TABS: ExplorerTabId[] = ["bg", "pose", "hair", "outfit"];

// ── Folder handle persistence ──────────────────────────────────────────────

export async function saveFolderHandle(
  tabId: ExplorerTabId,
  handle: FileSystemDirectoryHandle
): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_FOLDERS, "readwrite");
    tx.objectStore(STORE_FOLDERS).put(handle, tabId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadAllFolderHandles(): Promise<
  Partial<Record<ExplorerTabId, FileSystemDirectoryHandle>>
> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_FOLDERS, "readonly");
    const result: Partial<Record<ExplorerTabId, FileSystemDirectoryHandle>> = {};
    const req = tx.objectStore(STORE_FOLDERS).openCursor();
    req.onsuccess = () => {
      const cur = req.result;
      if (cur) {
        result[cur.key as ExplorerTabId] = cur.value as FileSystemDirectoryHandle;
        cur.continue();
      } else {
        resolve(result);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

// ── Favorites ──────────────────────────────────────────────────────────────

export interface ExplorerFavorite {
  id: string;
  name: string;
  /** Compressed thumbnail (160 px) for grid display */
  thumbDataUrl: string;
  /** Compressed data URL (≤ 1024 px) used when "selecting" the image */
  fullDataUrl: string;
  addedAt: number;
}

export async function addExplorerFavorite(
  item: ExplorerFavorite
): Promise<ExplorerFavorite[]> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_FAVORITES, "readwrite");
    tx.objectStore(STORE_FAVORITES).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  return listExplorerFavorites();
}

export async function removeExplorerFavorite(
  id: string
): Promise<ExplorerFavorite[]> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_FAVORITES, "readwrite");
    tx.objectStore(STORE_FAVORITES).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  return listExplorerFavorites();
}

export async function listExplorerFavorites(): Promise<ExplorerFavorite[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_FAVORITES, "readonly");
    const req = tx.objectStore(STORE_FAVORITES).getAll();
    req.onsuccess = () =>
      resolve(
        ((req.result as ExplorerFavorite[]) ?? []).sort(
          (a, b) => b.addedAt - a.addedAt
        )
      );
    req.onerror = () => reject(req.error);
  });
}

/**
 * バックアップ復元用：id が重複しないお気に入りだけ追加する（既存は上書き・削除しない）。
 */
export async function mergeExplorerFavorites(
  items: ExplorerFavorite[]
): Promise<{ added: number; skipped: number }> {
  const incoming = items ?? [];
  const existing = await listExplorerFavorites();
  const existingIds = new Set(existing.map((f) => f.id));
  const db = await openDb();
  let added = 0;
  let skipped = 0;
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_FAVORITES, "readwrite");
    const store = tx.objectStore(STORE_FAVORITES);
    for (const it of incoming) {
      if (!it || typeof it.id !== "string" || !it.fullDataUrl || existingIds.has(it.id)) {
        skipped++;
        continue;
      }
      store.put(it);
      existingIds.add(it.id);
      added++;
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  return { added, skipped };
}

// ── Image loading ──────────────────────────────────────────────────────────

export interface ExplorerImage {
  /** Filename — unique per-folder session */
  id: string;
  name: string;
  /** Object URL for in-memory display */
  objectUrl: string;
  fileHandle: FileSystemFileHandle;
  /** file.lastModified timestamp for sort */
  lastModified: number;
}

const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "webp", "gif", "avif"]);

export async function readImagesFromDir(
  dirHandle: FileSystemDirectoryHandle,
): Promise<ExplorerImage[]> {
  const images: ExplorerImage[] = [];
  for await (const [name, entry] of dirHandle.entries()) {
    if (entry.kind !== "file") continue;
    const ext = name.split(".").pop()?.toLowerCase() ?? "";
    if (!IMAGE_EXTS.has(ext)) continue;
    try {
      const fileHandle = entry as FileSystemFileHandle;
      const file = await fileHandle.getFile();
      const objectUrl = URL.createObjectURL(file);
      images.push({ id: name, name, objectUrl, fileHandle, lastModified: file.lastModified });
    } catch {
      // 読み取れないファイルはスキップ（権限エラー・破損ファイルなど）
      console.warn(`[miniExplorer] skipped unreadable file: ${name}`);
    }
  }
  return images;
}

// ── Root-handle persistence (single folder, new Explorer UI) ───────────────

const ROOT_KEY = "__root__";

export async function saveRootHandle(
  handle: FileSystemDirectoryHandle,
): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_FOLDERS, "readwrite");
    tx.objectStore(STORE_FOLDERS).put(handle, ROOT_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadRootHandle(): Promise<FileSystemDirectoryHandle | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_FOLDERS, "readonly");
    const req = tx.objectStore(STORE_FOLDERS).get(ROOT_KEY);
    req.onsuccess = () => resolve((req.result as FileSystemDirectoryHandle) ?? null);
    req.onerror = () => reject(req.error);
  });
}

// ── Subfolder listing ──────────────────────────────────────────────────────

export interface ExplorerSubfolder {
  name: string;
  handle: FileSystemDirectoryHandle;
}

export async function readSubfolders(
  dirHandle: FileSystemDirectoryHandle,
): Promise<ExplorerSubfolder[]> {
  const folders: ExplorerSubfolder[] = [];
  try {
    for await (const [name, entry] of dirHandle.entries()) {
      if (entry.kind === "directory") {
        folders.push({ name, handle: entry as FileSystemDirectoryHandle });
      }
    }
  } catch { /* permission denied */ }
  folders.sort((a, b) => a.name.localeCompare(b.name, "ja"));
  return folders;
}

/** Re-check (and if necessary re-prompt for) read permission */
export async function verifyPermission(
  handle: FileSystemDirectoryHandle
): Promise<boolean> {
  try {
    const opts: FileSystemHandlePermissionDescriptor = { mode: "read" };
    if ((await handle.queryPermission(opts)) === "granted") return true;
    if ((await handle.requestPermission(opts)) === "granted") return true;
    return false;
  } catch {
    return false;
  }
}

// ── Image helpers ──────────────────────────────────────────────────────────

/**
 * Downscale an image (given as src URL) and return a JPEG data URL.
 * @param maxSize max dimension in pixels
 * @param quality JPEG quality 0–1
 */
export function compressToDataUrl(
  src: string,
  maxSize = 240,
  quality = 0.82
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const ratio = Math.min(maxSize / img.naturalWidth, maxSize / img.naturalHeight, 1);
      const w = Math.round(img.naturalWidth * ratio);
      const h = Math.round(img.naturalHeight * ratio);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(src); return; }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });
}

/** Read a FileSystemFileHandle and return a full data URL */
export function fileHandleToDataUrl(
  handle: FileSystemFileHandle
): Promise<string> {
  return new Promise((resolve, reject) => {
    void handle.getFile().then((file) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  });
}

/** True when the browser supports File System Access API */
export const isFSASupported = (): boolean =>
  typeof window !== "undefined" && "showDirectoryPicker" in window;

// ── Recent folders (Quick Access) ─────────────────────────────────────────

const MAX_RECENTS = 6;
const RECENT_PREFIX = "__recent_";

/**
 * Quick Access に追加した1フォルダ。
 * addedAt = アプリに追加した日時（＝表示する日付・月色・並び順）。機能導入前の既存フォルダ／旧データは null（＝OS名表示）。
 * handle は idb 永続化可能な FileSystemDirectoryHandle。ラッパーごと構造化クローンで保存する。
 */
export interface RecentFolder {
  handle: FileSystemDirectoryHandle;
  addedAt: number | null;
}

/** 保存値が新形式 {handle, addedAt} か（旧＝生ハンドル）を判定。 */
function isRecentRecord(v: unknown): v is { handle: FileSystemDirectoryHandle; addedAt?: unknown } {
  return typeof v === "object" && v !== null && "handle" in v;
}

const RECENT_RESET_FLAG = "ipm_recentDatesReset_v1";

/**
 * 機能導入前の既存フォルダを一度だけ undated 化する（＝OS名表示に戻し「無視」する）。
 * これ以降に追加したフォルダだけが addedAt（追加日）を持つ。handle は保持（Quick Access からは消さない）。
 * localStorage フラグで1回のみ実行。clear/deleteDatabase は使わず __recent_i スロットの再書き込みのみ（非破壊）。
 *
 * フラグは破壊的な書き換えの「前」に立てる：idb書込後にフラグ書込だけ失敗すると次回mountで
 * reset が再実行され、その間に新規追加された正当な addedAt まで巻き戻す事故になるため。
 * フラグ書込（localStorage）自体が失敗する環境（quota超過/プライベートモード等）では、
 * reset 本体を一切実行しない（安全側＝二重実行の可能性がある操作はしない）。
 */
export async function resetRecentDatesOnce(): Promise<void> {
  try {
    if (localStorage.getItem(RECENT_RESET_FLAG)) return;
    localStorage.setItem(RECENT_RESET_FLAG, "1");
  } catch { return; }
  const existing = await loadRecentFolders();
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx    = db.transaction(STORE_FOLDERS, "readwrite");
    const store = tx.objectStore(STORE_FOLDERS);
    for (let i = 0; i < MAX_RECENTS; i++) store.delete(`${RECENT_PREFIX}${i}`);
    existing.forEach((r, i) => store.put({ handle: r.handle, addedAt: null }, `${RECENT_PREFIX}${i}`));
    tx.oncomplete = () => resolve();
    tx.onerror   = () => reject(tx.error);
  });
}

/**
 * 既存リストの中から handle と実体が同じエントリの index を探す（isSameEntry・名前でなく実体比較）。
 * 別の場所にある同名フォルダ（例：複数の「Photos」）を別エントリとして扱うため。
 * isSameEntry が使えない環境のみ、従来どおり名前一致にフォールバックする。
 */
async function findSameEntryIndex(
  list: RecentFolder[],
  handle: FileSystemDirectoryHandle,
): Promise<number> {
  for (let i = 0; i < list.length; i++) {
    try {
      if (await handle.isSameEntry(list[i].handle)) return i;
    } catch {
      if (list[i].handle.name === handle.name) return i;
    }
  }
  return -1;
}

/**
 * フォルダを Quick Access に記録する（additive・非破壊）。
 * - 新規／旧 undated：addedAt=now（＝追加した日）を付与。
 * - 既に addedAt を持つ再追加（同一実体）：保持し先頭へ動かさない。
 * - 別の場所にある同名フォルダは別エントリとして追加する（実体比較・M4修正）。
 * - 並びは addedAt desc（undated 末尾）で最大6件。__recent_i スロットのみ書き換える。
 */
export async function saveRecentFolder(
  handle: FileSystemDirectoryHandle,
): Promise<void> {
  const existing = await loadRecentFolders();
  const now = Date.now();
  const idx = await findSameEntryIndex(existing, handle);
  let next: RecentFolder[];
  if (idx >= 0) {
    const keptAddedAt = existing[idx].addedAt ?? now;
    next = existing.slice();
    next[idx] = { handle, addedAt: keptAddedAt };
  } else {
    next = [{ handle, addedAt: now }, ...existing];
  }
  next.sort((a, b) => (b.addedAt ?? -Infinity) - (a.addedAt ?? -Infinity));
  next = next.slice(0, MAX_RECENTS);

  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx    = db.transaction(STORE_FOLDERS, "readwrite");
    const store = tx.objectStore(STORE_FOLDERS);
    // Clear recent slots then rewrite（__root__/タブ別ハンドルは別キーなので不触）
    for (let i = 0; i < MAX_RECENTS; i++) store.delete(`${RECENT_PREFIX}${i}`);
    next.forEach((r, i) => store.put({ handle: r.handle, addedAt: r.addedAt }, `${RECENT_PREFIX}${i}`));
    tx.oncomplete = () => resolve();
    tx.onerror   = () => reject(tx.error);
  });
}

/**
 * Quick Access のフォルダ一覧を addedAt desc（undated 末尾）で返す。
 * 旧データ（生ハンドル）は addedAt:null として後方互換で読む。
 */
export async function loadRecentFolders(): Promise<RecentFolder[]> {
  const db      = await openDb();
  const results: RecentFolder[] = [];
  for (let i = 0; i < MAX_RECENTS; i++) {
    const v = await new Promise<unknown>((resolve) => {
      const tx  = db.transaction(STORE_FOLDERS, "readonly");
      const req = tx.objectStore(STORE_FOLDERS).get(`${RECENT_PREFIX}${i}`);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror   = () => resolve(null);
    });
    if (!v) continue;
    if (isRecentRecord(v)) {
      results.push({ handle: v.handle, addedAt: typeof v.addedAt === "number" ? v.addedAt : null });
    } else {
      results.push({ handle: v as FileSystemDirectoryHandle, addedAt: null });
    }
  }
  return results;
}
