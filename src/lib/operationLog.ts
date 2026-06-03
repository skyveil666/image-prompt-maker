/**
 * 操作ログ — skyveil好み学習エージェントの「行動データ」を IndexedDB に蓄積する。
 *
 * 目的：押したボタン・選んだ変更対象・プリセット・生成・評価・お気に入り等の
 *       「ユーザーが実際にどう操作したか」を長期的に記録し、好みプロファイルの
 *       材料にする。軽い処理（ログ保存）はここで常時実行し、重い分析（Gemini）は
 *       skyveilProfile 側で必要なタイミングのみ行う。
 *
 * 注意：APIへは送らない。アプリ内（端末ローカル）にのみ保存する。
 */

import { put, getAll, clear, remove, STORE_OPERATION_LOG } from "./idb";

/** ログ種別。増えてもよいが、分析しやすいよう代表的なものを定義。 */
export type OperationType =
  | "generate"        // プロンプト生成
  | "favorite"        // お気に入り登録/解除
  | "rate"            // 評価ボタン（良い/まあまあ/微妙/失敗）
  | "arrange_save"    // アレンジ保存
  | "ng_add"          // 禁止タグ追加
  | "policy_apply"    // 重複分析の提案を反映
  | "preset"          // プリセット/神引き/世界観等のボタン
  | "reset";          // リセット操作

export interface OperationLogEntry {
  /** 一意ID（ts と連番から決定的に生成） */
  id: string;
  /** 記録時刻（ms） */
  ts: number;
  /** 種別 */
  type: OperationType;
  /** 任意の付随情報（変更対象・プリセット・評価値など） */
  detail?: Record<string, unknown>;
}

/** ログ保持上限（古いものから間引く） */
const MAX_ENTRIES = 2000;
/** ID 重複防止用の連番（同一 ms に複数記録されても衝突しない） */
let seq = 0;

/**
 * 操作を1件記録する。失敗しても生成フロー等を止めないため握りつぶす。
 */
export async function logOperation(
  type: OperationType,
  detail?: Record<string, unknown>,
  ts: number = Date.now(),
): Promise<void> {
  try {
    seq = (seq + 1) % 1_000_000;
    const entry: OperationLogEntry = {
      id: `${ts}_${seq.toString().padStart(6, "0")}`,
      ts,
      type,
      ...(detail && Object.keys(detail).length > 0 ? { detail } : {}),
    };
    await put(STORE_OPERATION_LOG, entry);
    // 上限超過時のみ間引く（毎回は走らせない：32件に1回程度）
    if ((seq & 0x1f) === 0) await pruneIfNeeded();
  } catch {
    /* ローカルログ失敗は無視（生成・評価を妨げない） */
  }
}

async function pruneIfNeeded(): Promise<void> {
  try {
    const all = await getAll<OperationLogEntry>(STORE_OPERATION_LOG);
    if (all.length <= MAX_ENTRIES) return;
    // 新しい順に MAX_ENTRIES 件残し、古いものを削除
    const sorted = all.sort((a, b) => b.ts - a.ts);
    const toRemove = sorted.slice(MAX_ENTRIES);
    for (const e of toRemove) await remove(STORE_OPERATION_LOG, e.id);
  } catch {
    /* noop */
  }
}

export async function getOperationLog(): Promise<OperationLogEntry[]> {
  const all = await getAll<OperationLogEntry>(STORE_OPERATION_LOG);
  return all.sort((a, b) => b.ts - a.ts);
}

export interface OperationStats {
  total: number;
  /** 直近7日の件数 */
  last7d: number;
  /** 種別ごとの件数 */
  byType: Record<string, number>;
  /** 最後に記録した時刻 */
  lastTs: number | null;
}

export async function getOperationStats(nowMs: number = Date.now()): Promise<OperationStats> {
  const all = await getAll<OperationLogEntry>(STORE_OPERATION_LOG);
  const cutoff = nowMs - 7 * 24 * 60 * 60 * 1000;
  const byType: Record<string, number> = {};
  let last7d = 0;
  let lastTs: number | null = null;
  for (const e of all) {
    byType[e.type] = (byType[e.type] ?? 0) + 1;
    if (e.ts >= cutoff) last7d++;
    if (lastTs == null || e.ts > lastTs) lastTs = e.ts;
  }
  return { total: all.length, last7d, byType, lastTs };
}

export async function clearOperationLog(): Promise<void> {
  await clear(STORE_OPERATION_LOG);
}
