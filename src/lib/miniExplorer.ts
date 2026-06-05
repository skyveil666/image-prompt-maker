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

/** Save a folder as the most-recently-used root (deduped by name, max 6). */
export async function saveRecentFolder(
  handle: FileSystemDirectoryHandle,
): Promise<void> {
  const existing = await loadRecentFolders();
  const deduped  = [handle, ...existing.filter((h) => h.name !== handle.name)].slice(
    0,
    MAX_RECENTS,
  );
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx    = db.transaction(STORE_FOLDERS, "readwrite");
    const store = tx.objectStore(STORE_FOLDERS);
    // Clear old slots then rewrite
    for (let i = 0; i < MAX_RECENTS; i++) store.delete(`${RECENT_PREFIX}${i}`);
    deduped.forEach((h, i) => store.put(h, `${RECENT_PREFIX}${i}`));
    tx.oncomplete = () => resolve();
    tx.onerror   = () => reject(tx.error);
  });
}

/** Load all saved recent folders (most-recent-first, holes removed). */
export async function loadRecentFolders(): Promise<FileSystemDirectoryHandle[]> {
  const db      = await openDb();
  const results: FileSystemDirectoryHandle[] = [];
  for (let i = 0; i < MAX_RECENTS; i++) {
    const h = await new Promise<FileSystemDirectoryHandle | null>((resolve) => {
      const tx  = db.transaction(STORE_FOLDERS, "readonly");
      const req = tx.objectStore(STORE_FOLDERS).get(`${RECENT_PREFIX}${i}`);
      req.onsuccess = () => resolve((req.result as FileSystemDirectoryHandle) ?? null);
      req.onerror   = () => resolve(null);
    });
    if (h) results.push(h);
  }
  return results;
}
