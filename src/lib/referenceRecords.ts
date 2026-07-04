/**
 * referenceRecords — Reference Picker / Compare Mode の「参照レコード」を IndexedDB に蓄積する。
 *
 * 目的：参照画像から抽出・適用した要素と、その生成バッチ(batchId)を1件のレコードとして残し、
 *       後段の Compare Mode（参照↔生成の並列比較・一致率評価）と学習エージェント連携の土台にする。
 *
 * 設計（docs/24）：
 *   - 生成ロジック・抽出ロジック・既存の履歴/お気に入り保存には一切影響しない（本ファイルは追加のみ）。
 *   - 保存はベストエフォート（失敗しても生成フローを止めない）。APIへは送らず端末ローカルのみ。
 *
 * ストア：STORE_REFERENCE_RECORDS（idb v6・加算的に追加。index: batchId / createdAt）。
 */

import {
  put,
  get,
  getAll,
  getByIndex,
  remove,
  STORE_REFERENCE_RECORDS,
} from "./idb";

export interface ReferenceRecord {
  /** 一意ID（createdAt と連番から決定的に生成） */
  id: string;
  /** 記録時刻（ms） */
  createdAt: number;
  /** 参照画像サムネ（dataURL・makeThumbnail で圧縮済み） */
  refThumb: string;
  /** 画像の内容ハッシュ（imageContentHash）。段階3：同一画像の重複保存を防ぐdedupキー（optional・後方互換）。 */
  contentHash?: string;
  /** 段階1：Nスロット対応の器（optional・現状は未使用＝書き込み側は追加しない）。
   *  段階2でスロット別サムネ＋カテゴリごとの抽出元スロット index（imageSourceMap 等）を運用する。
   *  既存レコード（refThumb 単一）は本フィールド無しのまま後方互換で読める。 */
  refThumbs?: string[];
  /** Gemini 抽出の13カテゴリ（cat -> テキスト） */
  extracted: Record<string, string>;
  /** 実際に適用した軸（referenceNote：cat -> テキスト） */
  applied: Record<string, string>;
  /** 紐付く生成バッチ（history の batchId と一致） */
  batchId: string;
  /** Phase C：生成結果画像を再抽出した13カテゴリ（任意） */
  resultExtracted?: Record<string, string>;
  /** Phase C：項目別一致率 0-100（cat -> score。任意） */
  matchScores?: Record<string, number>;
  /** Phase C：一致率を算出した時刻 */
  matchComputedAt?: number;
  /** Phase C：採点・評価した生成結果の出所（history item と画像index） */
  resultImageRef?: { historyItemId: string; imageIndex: number };
  /** Phase C：全体のユーザー評価（5=良かった / 3=普通 / 1=違う） */
  userEvalOverall?: 5 | 3 | 1;
  /** Phase C：任意の軸別評価（押した軸のみ・5=👍 / 1=👎） */
  userAxisEval?: Record<string, 5 | 1>;
  /** Phase C：評価した時刻 */
  evaluatedAt?: number;
  /** 任意：お気に入り（学習連携用） */
  favorite?: boolean;
  /** 保存種別（任意・後方互換）。"picker"=Reference Picker から手動保存（生成バッチ無し）。
   *  未設定 or "generation"＝生成時に自動保存（既存挙動）。読み取り側は「未設定＝generation」とみなす。 */
  kind?: "generation" | "picker";
  /** 任意：ユーザーが付けるラベル（将来のアルバム表示・整理用。現状は未入力）。 */
  note?: string;
}

/** 参照レコード保持上限（非favoriteのみでカウント。古いものから間引く。サムネ込みなので控えめ）。 */
const MAX_RECORDS = 50;
/** ID 重複防止用の連番（同一 ms に複数記録されても衝突しない） */
let seq = 0;

/** 保存時に渡す入力（id / createdAt は自動採番） */
export type ReferenceRecordInput = Omit<ReferenceRecord, "id" | "createdAt">;

/**
 * 参照レコードを1件保存する（段階3：contentHash dedup対応）。
 * - rec.contentHash が指定され、同じ contentHash を持つ既存レコードがあれば、新規作成せず
 *   その既存レコードの createdAt だけ更新して返す（recentImages.ts と同じ「先勝ち更新」パターン。
 *   extracted/applied 等の他フィールドは書き換えない）。
 * - contentHash 未指定（既存呼び出し元）は従来どおり常に新規作成＝完全後方互換。
 * - 失敗しても生成フローを止めないため握りつぶす。
 * 戻り値：保存/更新できた id（失敗時 null）。
 */
export async function saveReferenceRecord(
  rec: ReferenceRecordInput,
  createdAt: number = Date.now(),
): Promise<string | null> {
  try {
    if (rec.contentHash) {
      const all = await getAll<ReferenceRecord>(STORE_REFERENCE_RECORDS);
      const existing = all.find((r) => r.contentHash === rec.contentHash);
      if (existing) {
        await put(STORE_REFERENCE_RECORDS, { ...existing, createdAt });
        return existing.id;
      }
    }
    seq = (seq + 1) % 1_000_000;
    const id = `ref_${createdAt}_${seq.toString().padStart(6, "0")}`;
    const entry: ReferenceRecord = { ...rec, id, createdAt };
    await put(STORE_REFERENCE_RECORDS, entry);
    // 上限超過時のみ間引く（毎回は走らせない：16件に1回程度）
    if ((seq & 0x0f) === 0) await pruneIfNeeded();
    return id;
  } catch {
    /* ローカル保存失敗は無視（生成を妨げない） */
    return null;
  }
}

/**
 * 上限超過分を古い順に間引く。★favorite=true は件数カウント・削除対象の両方から除外（保護）。
 * 非favoriteレコードだけを createdAt desc で並べ、上限を超えた古いものだけ削除する。
 */
async function pruneIfNeeded(): Promise<void> {
  try {
    const all = await getAll<ReferenceRecord>(STORE_REFERENCE_RECORDS);
    const nonFavorite = all.filter((r) => !r.favorite);
    if (nonFavorite.length <= MAX_RECORDS) return;
    const sorted = nonFavorite.sort((a, b) => b.createdAt - a.createdAt);
    const toRemove = sorted.slice(MAX_RECORDS);
    await Promise.all(toRemove.map((e) => remove(STORE_REFERENCE_RECORDS, e.id)));
  } catch {
    /* noop */
  }
}

/** 全参照レコードを新しい順で取得。 */
export async function getReferenceRecords(): Promise<ReferenceRecord[]> {
  const all = await getAll<ReferenceRecord>(STORE_REFERENCE_RECORDS);
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

/** id 指定で1件取得。 */
export async function getReferenceRecord(id: string): Promise<ReferenceRecord | null> {
  return get<ReferenceRecord>(STORE_REFERENCE_RECORDS, id);
}

/** batchId に紐付く参照レコードを取得（通常0〜1件）。 */
export async function getReferenceRecordsByBatch(batchId: string): Promise<ReferenceRecord[]> {
  return getByIndex<ReferenceRecord>(STORE_REFERENCE_RECORDS, "batchId", batchId);
}

/**
 * 既存レコードに部分更新をマージして保存（Phase C の一致率・評価・お気に入り追記用）。
 * 対象が無ければ false。既存フィールドは保持（破壊しない）。
 */
export async function updateReferenceRecord(
  id: string,
  patch: Partial<Omit<ReferenceRecord, "id" | "createdAt">>,
): Promise<boolean> {
  try {
    const cur = await get<ReferenceRecord>(STORE_REFERENCE_RECORDS, id);
    if (!cur) return false;
    await put(STORE_REFERENCE_RECORDS, { ...cur, ...patch });
    return true;
  } catch {
    return false;
  }
}

/** id 指定で1件削除（手動整理用）。 */
export async function removeReferenceRecord(id: string): Promise<void> {
  await remove(STORE_REFERENCE_RECORDS, id);
}
