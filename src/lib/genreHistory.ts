/**
 * マンネリ回避エンジン用：直近に使われたジャンルIDのリングバッファ。
 *
 * 生成リクエストの recentGenres として往復させ、サーバの varietyEngine がこれを
 * 回避してジャンルを抽選する。実装は createRecentRing に共通化（subStyleHistory と同方式）。
 * 最大12件（おおよそ直近3バッチ分）。
 */

import { createRecentRing } from "./recentRing";

const ring = createRecentRing("ipm_recent_genres_v1", 12);

/** 直近ジャンルID配列を読み込む（新しい順）。壊れていたら空配列。 */
export const getRecentGenres = ring.get;
/** 新しく使われたジャンルIDを履歴の先頭に追加する（バッチ内重複除去・既存IDは前方繰り上げ）。 */
export const pushRecentGenres = ring.push;
/** 履歴をクリアする（デバッグ・設定リセット用）。 */
export const clearRecentGenres = ring.clear;
