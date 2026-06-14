import { makeThumbnail } from "./imageThumb";

/**
 * 画像取り込みの共通プリミティブ。
 * 各コンポーネントに散在していた FileReader→dataURL / →サムネ化 の重複を一本化する。
 */

/** File を dataURL 文字列に読む。失敗時は reject。 */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * 画像 File を「サムネ化した dataURL」に変換する共通処理。
 * - 画像でない File は null を返す（呼び出し側でスキップ）。
 * - サムネ化に失敗したら元 dataURL を返す（生成結果スロット等の従来挙動を踏襲）。
 */
export async function fileToThumbnail(
  file: File, maxEdge = 600, quality = 0.83,
): Promise<string | null> {
  if (!file.type.startsWith("image/")) return null;
  const raw = await readFileAsDataUrl(file);
  try {
    return await makeThumbnail(raw, maxEdge, quality);
  } catch {
    return raw;
  }
}
