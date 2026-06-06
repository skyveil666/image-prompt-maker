/**
 * motifTags — 分析ラボ（Lab-2）のモチーフ自由タグ。
 *
 * 各モチーフ(motifId)に自由なラベル（例：「避けたい」「季節もの」「実験中」）を付けて
 * 整理・フィルタするための **ラボ内メタデータ**。localStorage `ipm_motif_tags_v1` に保存する。
 *
 * 注意：タグは生成プロンプトには一切反映しない（分析ロジック・出現制御とは独立）。
 *       出現制御は motifPolicy（レベル）が担当。タグは UI 整理用のみ。
 */

const KEY = "ipm_motif_tags_v1";

/** motifId → タグ配列 */
export type MotifTagMap = Record<string, string[]>;

export function loadMotifTags(): MotifTagMap {
  try {
    const o = JSON.parse(localStorage.getItem(KEY) || "{}");
    return o && typeof o === "object" && !Array.isArray(o) ? (o as MotifTagMap) : {};
  } catch {
    return {};
  }
}

export function saveMotifTags(map: MotifTagMap): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* 保存失敗は無視（ラボ整理用メタデータ） */
  }
}

export function tagsForMotif(map: MotifTagMap, id: string): string[] {
  return map[id] ?? [];
}

/** 指定モチーフ群に同じタグを付与（重複は無視）。新しい map を返す（純粋）。 */
export function addTagToMotifs(map: MotifTagMap, ids: string[], tag: string): MotifTagMap {
  const t = tag.trim().slice(0, 24);
  if (!t || ids.length === 0) return map;
  const next: MotifTagMap = { ...map };
  for (const id of ids) {
    const cur = next[id] ?? [];
    if (!cur.includes(t)) next[id] = [...cur, t];
  }
  return next;
}

/** 指定モチーフ群から同じタグを除去。空になった motif はキーごと削除。新しい map を返す（純粋）。 */
export function removeTagFromMotifs(map: MotifTagMap, ids: string[], tag: string): MotifTagMap {
  const t = tag.trim();
  if (!t || ids.length === 0) return map;
  const next: MotifTagMap = { ...map };
  for (const id of ids) {
    const cur = next[id];
    if (cur) {
      const filtered = cur.filter((x) => x !== t);
      if (filtered.length) next[id] = filtered;
      else delete next[id];
    }
  }
  return next;
}

/** 全タグ（重複なし・五十音順）。フィルタ候補に使う。 */
export function allMotifTags(map: MotifTagMap): string[] {
  return Array.from(new Set(Object.values(map).flat())).sort((a, b) => a.localeCompare(b, "ja"));
}
