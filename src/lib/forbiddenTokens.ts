/**
 * 禁止トークン — ユーザーが指定したモチーフ・要素を
 * 意味ベースで同義語展開してプロンプトに注入する。
 * localStorage に保存して永続化。
 *
 * 例：「ドレス」→ dress, gown, princess dress, goddess dress, … を除外
 */

const STORAGE_KEY = "ipm_forbidden_tokens_v1";

// ── 意味クラスタ辞書 ──────────────────────────────────────────────────────────
// キー   : ユーザーが入力する代表語（日本語 / 英語）
// 値     : プロンプトから除外する語句リスト（英語中心）

const SEMANTIC_CLUSTERS: Readonly<Record<string, readonly string[]>> = {

  // ── モチーフ系 ───────────────────────────────────────────────────────────────
  "黒バラ":       ["black rose", "dark rose", "gothic rose", "ominous rose",
                   "crimson-black rose", "black flower"],
  "ドレス":       ["dress", "gown", "princess dress", "goddess dress",
                   "ball gown", "flowing dress", "elaborate dress",
                   "layered dress", "elegant dress"],
  "クリスタル":   ["crystal", "crystal orb", "glowing crystal", "gem cluster",
                   "crystal formation", "crystal shard", "crystal background",
                   "crystal light"],
  "発光球":       ["glowing orb", "energy ball", "light sphere", "luminous orb",
                   "glowing sphere", "floating orb", "light orb"],
  "羽":           ["wings", "feathers", "angel wings", "transparent wings",
                   "gossamer wings", "wing motif", "particle wings",
                   "ethereal wings", "crystal wings"],
  "ネオン刀":     ["neon sword", "neon blade", "neon katana",
                   "glowing sword", "glowing katana", "luminous blade",
                   "energy sword"],
  "HUD":          ["HUD", "HUD display", "holographic UI",
                   "cyber interface", "digital overlay",
                   "augmented reality panel", "heads-up display"],
  "ホログラム":   ["hologram", "holographic display", "transparent screen",
                   "glowing holographic", "cyber display",
                   "holographic terminal", "floating hologram"],
  "ステンドグラス": ["stained glass", "stained glass window",
                   "colorful glass panel", "gothic stained glass",
                   "church glass"],
  "白背景":       ["white background", "white wall", "plain white backdrop",
                   "clean white background", "white studio"],
  "透明素材":     ["transparent", "transparent fabric",
                   "see-through fabric", "clear material",
                   "translucent fabric", "PVC transparent"],
  "発光クリスタル": ["glowing crystal", "crystal glow", "luminous crystal",
                   "radiant gem", "glowing gem", "sparkling crystal"],
  "姫系":         ["princess style", "princess outfit", "princess dress",
                   "royal attire", "princess aesthetic", "tiara dress"],
  "神秘系":       ["mystical aura", "arcane glow", "ethereal glow",
                   "otherworldly", "mystical background"],
  "PVC":          ["PVC", "PVC dress", "transparent PVC",
                   "glossy PVC", "clear PVC fabric"],
  "ゴシック":     ["gothic", "dark gothic", "gothic style",
                   "gothic aesthetic", "gothic dress", "gothic outfit",
                   "gothic costume"],
  "ネオン":       ["neon glow", "neon light", "neon sign",
                   "LED strip", "neon color", "neon-lit",
                   "neon tube"],
  "量産AI":       ["generic AI style", "typical AI pose",
                   "mass-produced AI look", "stock AI aesthetic",
                   "AI template style"],
  "Y3K青":        ["Y3K blue", "blue-violet futuristic",
                   "cyan-purple sci-fi", "blue neon future",
                   "blue cyber aesthetic"],
  "青系":         ["blue tones", "blue palette", "blue-dominant",
                   "blue-cast scene", "cool blue scheme",
                   "all-blue color"],
  "ホログラム端末": ["holographic terminal", "floating screen",
                   "holographic display", "cyber terminal",
                   "floating hologram interface"],
  "サイバー女子":  ["cyber girl aesthetic", "cyber anime girl",
                   "neon cyber fashion", "cyberpunk girl",
                   "cyber fashion model"],

  // ── 英語 key（英語で入力された場合） ─────────────────────────────────────────
  "crystal":      ["crystal", "crystal orb", "glowing crystal",
                   "gem cluster", "crystal formation", "crystal shard"],
  "wings":        ["wings", "feathers", "angel wings",
                   "transparent wings", "gossamer wings"],
  "hologram":     ["hologram", "holographic display",
                   "transparent screen", "holographic UI"],
  "neon":         ["neon glow", "neon light", "neon sign",
                   "LED strip", "neon-lit"],
  "dress":        ["dress", "gown", "princess dress",
                   "ball gown", "flowing dress", "goddess dress"],
  "gothic":       ["gothic", "dark gothic", "gothic dress",
                   "gothic aesthetic"],
  "holographic":  ["holographic", "hologram", "holographic display",
                   "holographic UI", "cyber holographic"],
  "stained glass": ["stained glass", "stained glass window",
                   "colorful glass panel", "gothic glass"],
};

// ── 公開 API ──────────────────────────────────────────────────────────────────

/** 1 つの入力トークンを展開して除外語リストを返す */
export function expandToken(token: string): string[] {
  const norm = token.trim();
  if (!norm) return [];

  // 完全一致
  if (SEMANTIC_CLUSTERS[norm]) return [...SEMANTIC_CLUSTERS[norm]];

  // 大文字小文字無視
  const lc  = norm.toLowerCase();
  const key = Object.keys(SEMANTIC_CLUSTERS).find((k) => k.toLowerCase() === lc);
  if (key) return [...SEMANTIC_CLUSTERS[key]];

  // マッチなし → 入力値そのまま
  return [norm];
}

/** 複数トークンを展開してフラット化した除外語リストを返す（重複除去済み） */
export function expandForbiddenTokens(tokens: string[]): string[] {
  const seen  = new Set<string>();
  const result: string[] = [];
  for (const t of tokens) {
    for (const e of expandToken(t)) {
      if (!seen.has(e)) { seen.add(e); result.push(e); }
    }
  }
  return result;
}

/** localStorage から禁止トークン一覧を読み込む */
export function loadForbiddenTokens(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

/** localStorage に禁止トークン一覧を保存する */
export function saveForbiddenTokens(tokens: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
  } catch { /* quota exceeded 等は無視 */ }
}

/**
 * 禁止トークンを既存の ngList 文字列にマージして返す。
 * buildInputs() でプロンプト生成前に使用する。
 */
export function mergeForbiddenIntoNgList(ngList: string, tokens: string[]): string {
  if (tokens.length === 0) return ngList;
  const expanded = expandForbiddenTokens(tokens).join(", ");
  return ngList ? `${ngList}\n${expanded}` : expanded;
}

/** トークンのプレビュー（展開後の最初の数語）を返す UI 用ヘルパー */
export function tokenPreview(token: string, maxWords = 4): string {
  const expanded = expandToken(token);
  if (expanded.length === 0) return token;
  const preview = expanded.slice(0, maxWords).join(", ");
  return expanded.length > maxWords ? `${preview}…` : preview;
}

/** 辞書に登録されている代表語一覧（サジェスト用） */
export const FORBIDDEN_SUGGESTIONS: readonly string[] = Object.keys(SEMANTIC_CLUSTERS)
  .filter((k) => /[぀-ヿ一-鿿]/.test(k)); // 日本語キーのみ
