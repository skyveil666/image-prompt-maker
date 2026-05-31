/**
 * 多様性エンジン — 直近の生成スタイルを記憶し、
 * 同じ背景・衣装・ムード・演出が連発されるのを防ぐ。
 *
 * セッション内メモリ。各ボタンを押すたびに App.tsx で更新する。
 */

/** 直近 MAX_RECENT 件のスタイル使用履歴 */
export interface VariationMemory {
  recentBgPlaces:    string[];  // 直近の背景 place ID
  recentOutfits:     string[];  // 直近の衣装スタイル ID
  recentMoods:       string[];  // 直近のムード ID
  recentFgEffects:   string[];  // 直近の前景エフェクト ID
  recentWorlds:      string[];  // 直近の世界観プリセット ID
  recentCompositions: string[]; // 直近の構図神引き ID（連続使用防止）
  lastScopes:        string[];  // 直前のスコープ組み合わせ（同一連続禁止用）
}

export interface VariationUpdate {
  bgPlace?:     string;
  outfit?:      string;
  moods?:       string[];
  fgEffect?:    string;
  world?:       string;
  composition?: string;  // 構図神引き選択 ID
  scopes?:      string[]; // 適用したスコープ（lastScopes に記録）
}

const MAX_RECENT = 8;

export function createEmptyMemory(): VariationMemory {
  return {
    recentBgPlaces:    [],
    recentOutfits:     [],
    recentMoods:       [],
    recentFgEffects:   [],
    recentWorlds:      [],
    recentCompositions: [],
    lastScopes:        [],
  };
}

function addToList(list: string[], items: string[]): string[] {
  // 末尾に追加 → 重複除去 → 最新 MAX_RECENT 件のみ保持
  const combined = [...list, ...items];
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (let i = combined.length - 1; i >= 0; i--) {
    if (!seen.has(combined[i])) {
      seen.add(combined[i]);
      deduped.unshift(combined[i]);
    }
  }
  return deduped.slice(-MAX_RECENT);
}

export function updateMemory(mem: VariationMemory, update: VariationUpdate): VariationMemory {
  return {
    recentBgPlaces:    update.bgPlace     ? addToList(mem.recentBgPlaces,    [update.bgPlace])     : mem.recentBgPlaces,
    recentOutfits:     update.outfit      ? addToList(mem.recentOutfits,     [update.outfit])      : mem.recentOutfits,
    recentMoods:       update.moods       ? addToList(mem.recentMoods,       update.moods)         : mem.recentMoods,
    recentFgEffects:   update.fgEffect    ? addToList(mem.recentFgEffects,   [update.fgEffect])    : mem.recentFgEffects,
    recentWorlds:      update.world       ? addToList(mem.recentWorlds,      [update.world])       : mem.recentWorlds,
    recentCompositions: update.composition ? addToList(mem.recentCompositions, [update.composition]) : mem.recentCompositions,
    lastScopes:        update.scopes      ? [...update.scopes]                                     : mem.lastScopes,
  };
}

/**
 * プールから 1 個選ぶ。
 * 直近使用済みのものを避け、フレッシュなものを優先する。
 * すべて使用済みの場合はプールからランダムに選ぶ（フォールバック）。
 */
export function pickAvoidingRecent<T extends string>(
  pool:       readonly T[],
  recentUsed: readonly string[],
): T {
  const recentSet = new Set(recentUsed);
  const fresh = pool.filter((x) => !recentSet.has(x));
  const candidates = fresh.length > 0 ? fresh : [...pool];
  return candidates[Math.floor(Math.random() * candidates.length)];
}

/**
 * プールから N 個選ぶ。
 * 直近使用済みを避け、フレッシュなものを優先する。
 */
export function pickNAvoidingRecent<T extends string>(
  pool:       readonly T[],
  recentUsed: readonly string[],
  n:          number,
): T[] {
  const recentSet = new Set(recentUsed);
  const fresh = pool.filter((x) => !recentSet.has(x)).sort(() => Math.random() - 0.5);
  const result: T[] = fresh.slice(0, n);
  if (result.length < n) {
    const extras = [...pool]
      .filter((x) => !result.includes(x))
      .sort(() => Math.random() - 0.5);
    result.push(...extras.slice(0, n - result.length));
  }
  return result;
}
