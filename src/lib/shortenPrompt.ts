/**
 * shortenPrompt — ChatGPT(Image2)向け 出力プロンプトの軽量化（§4外・純関数・後処理のみ）。
 *
 * 目的：生成済みプロンプト本文（chatgpt_safe 出力）の「品質・解剖補正の重複/冗長」だけを削り、
 *       1案あたりの文字数を約450〜600字に軽量化する。生成ロジック（§4 promptSystem）は不触。
 *
 * 削る対象（品質冗長のみ）:
 *   1. 【人体補正】行を短い定型1行へ圧縮（同行末尾に付く英語補足ごと置換＝最大の削り代）。
 *   2. 単独行の純英語 解剖補足（"Anatomically correct…" / "Legs: exactly two legs…" 等）を除去。
 *
 * ★絶対に削らない/変えない（安全方向・意味のある内容）:
 *   - 【NG】行は verbatim 温存（一字一句変えない）。
 *   - 【変更】【雰囲気】【光】【前提】【固定】【品質】等 本文（非性的・露出抑制・上品描写を含む）はそのまま通す。
 *
 * fail-safe：【見出し】が見つからない／何も削れない 等の想定外入力は原文をそのまま返す（壊さない）。
 *
 * ※ 本関数は「ユーザー向け出力テキストの整形」であり、サーバの安全ロジック（promptSystem /
 *   scopeFilter / sanitizer / gemini）には一切関与しない。安全方向は生成時に既に強制済みで、
 *   ここでは品質冗長のみを削るため効力は弱まらない。
 */

/** 案区切り（promptSystem unifiedFormat と一致）。複数案がまとまった文字列にも対応するため。 */
const PROPOSAL_SEPARATOR = "---案区切り---";

/** 【人体補正】の圧縮版（解剖補正の要点を全て保持した1行）。元の冗長な日本語＋英語重複を置換する。 */
const SHORT_BODY_FIX =
  "【人体補正】手指は片手5本・自然な関節・手首肘なめらか／脚・膝・足首の接地を整合／体型のプロポーションを元画像と同じに保ち脚や胴を縦に引き伸ばさない／標準〜ポートレートレンズ（広角歪み・魚眼不使用）。";

/** 単独行の「純英語 解剖補足」を検出（日本語を含まない行のみ対象＝本文の取りこぼし防止）。 */
const ENGLISH_BODY_FIX_RE =
  /^(Anatomically correct|Legs:\s|Keep natural|Keep body proportions|use standard-to-portrait|do not apply (fisheye|wide)|head\/leg\/face)/i;

/** 日本語（かな/カナ/漢字）を含むか。含む行は本文として保持（英語補足判定から除外）。 */
function hasJapanese(s: string): boolean {
  return /[぀-ヿ㐀-鿿]/.test(s);
}

/** 1案分の本文を短縮する。 */
function shortenOne(body: string): string {
  if (!body) return body;
  // fail-safe：見出しが1つも無ければ構造解析できない＝原文を返す
  if (!/【[^】]+】/.test(body)) return body;

  const lines = body.split("\n");
  const out: string[] = [];
  let touched = false;

  for (const line of lines) {
    // ★[NG] は安全方向ゆえ verbatim 温存（絶対に変えない）
    if (line.startsWith("【NG】")) {
      out.push(line);
      continue;
    }
    // 【人体補正】行 → 定型1行へ圧縮（同行に付く英語補足も同時に消える）
    if (line.startsWith("【人体補正】")) {
      out.push(SHORT_BODY_FIX);
      touched = true;
      continue;
    }
    // 単独行の純英語 解剖補足（日本語を含まない場合のみ）を除去
    const t = line.trim();
    if (t && !hasJapanese(t) && ENGLISH_BODY_FIX_RE.test(t)) {
      touched = true;
      continue;
    }
    // それ以外（本文・安全方向描写）はそのまま保持
    out.push(line);
  }

  // 何も削れなかった＝想定外 → 原文を返す（fail-safe）
  if (!touched) return body;

  // 余分な空行（3連以上）を2行に整理。内容は変えない。
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * 出力プロンプトを短縮する。複数案（案区切りあり）なら案ごとに適用して連結。
 * @param text chatgpt_safe の生成プロンプト本文（1案 or 区切り連結の複数案）
 */
export function shortenPrompt(text: string): string {
  if (!text || typeof text !== "string") return text;
  if (text.includes(PROPOSAL_SEPARATOR)) {
    return text
      .split(PROPOSAL_SEPARATOR)
      .map((part) => {
        // 区切り前後の改行/空白レイアウトは保持しつつ、中身だけ短縮
        const lead = part.match(/^\s*/)?.[0] ?? "";
        const tail = part.match(/\s*$/)?.[0] ?? "";
        return lead + shortenOne(part.trim()) + tail;
      })
      .join(PROPOSAL_SEPARATOR);
  }
  return shortenOne(text);
}
