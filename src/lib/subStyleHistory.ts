/**
 * 衣装サブジャンル履歴：直近で使われたサブジャンルIDのリングバッファ。
 *
 * 生成リクエストの recentSubStyles として往復させ、サーバの
 * outfitSubStyles.planSubStylesForBatch がこれを回避して抽選する。
 * 実装は createRecentRing に共通化（genreHistory と同方式）。
 * 最大30件（おおよそ直近5バッチ × 3個分）。
 */

import { createRecentRing } from "./recentRing";

const ring = createRecentRing("ipm_recent_substyles_v1", 30);

/** 直近サブジャンルID配列を読み込む（新しい順）。壊れていたら空配列。 */
export const getRecentSubStyles = ring.get;
/** 新しく使われたサブジャンルIDを履歴の先頭に追加する（バッチ内重複除去・既存IDは前方繰り上げ）。 */
export const pushRecentSubStyles = ring.push;
/** 履歴をクリアする */
export const clearRecentSubStyles = ring.clear;
