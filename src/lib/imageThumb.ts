/**
 * Image resize helpers used for IndexedDB storage + content hashing.
 *  - makeThumbnail(): 200〜300px JPEG q0.72。グリッドのサムネ用。
 *  - makeStorageSize(): 1600px 上限 JPEG q0.85。「直近の画像」再利用用。
 *  - imageContentHash(): 32x32 ダウンスケール後の RGBA を SHA-256。
 *     => 同じ被写体・同じピクセル構成なら、フォーマット差・微小なメタデータ差を
 *        無視して同じハッシュになる。「同じ画像のはずなのに重複保存される」事象を防ぐ。
 *  - sha256Hex(): 任意テキストの SHA-256（フォールバック用）。
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function resizeJpeg(
  dataUrl: string,
  maxEdge: number,
  quality: number
): Promise<string> {
  try {
    const img = await loadImage(dataUrl);
    const ratio = Math.min(maxEdge / img.width, maxEdge / img.height, 1);
    const w = Math.max(1, Math.round(img.width * ratio));
    const h = Math.max(1, Math.round(img.height * ratio));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return dataUrl;
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", quality);
  } catch {
    return dataUrl;
  }
}

export function makeThumbnail(dataUrl: string, maxEdge = 280, quality = 0.72) {
  return resizeJpeg(dataUrl, maxEdge, quality);
}

export function makeStorageSize(dataUrl: string, maxEdge = 1600, quality = 0.85) {
  return resizeJpeg(dataUrl, maxEdge, quality);
}

/**
 * 画像の中身に基づく内容ハッシュ。
 * 32x32 にリサイズした RGBA を SHA-256。
 * 同一被写体なら PNG/JPEG 等のフォーマット差・メタデータ差を無視して同じ値になる。
 */
export async function imageContentHash(dataUrl: string): Promise<string> {
  try {
    const img = await loadImage(dataUrl);
    const size = 32;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return sha256Hex(dataUrl);
    ctx.drawImage(img, 0, 0, size, size);
    const imageData = ctx.getImageData(0, 0, size, size);
    const buf = await crypto.subtle.digest("SHA-256", imageData.data);
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return sha256Hex(dataUrl);
  }
}

/** Hex SHA-256 — used as IndexedDB key fallback. */
export async function sha256Hex(text: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(text);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * 画像ファイルのバイナリそのものから SHA-256 ハッシュを作る。
 * 「直近の画像」の重複検出はこのハッシュを正本とする。
 * 同じファイル＝同じバイト列なので、フォーマット同一なら必ず同じ値になる。
 */
export async function fileHash(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const hashBuf = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
