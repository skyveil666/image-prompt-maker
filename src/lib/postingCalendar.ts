/**
 * postingCalendar — 1ヶ月投稿カレンダー生成（毎日1〜2枚X投稿する人向け）。
 *
 * 「今日何を投稿するか」の悩みを消すために、30日分の投稿テーマを自動割り当てる。
 * ローカルで決定的に生成（Gemini不要・オフラインOK）。曜日・時間帯・系統をローテーションし、
 * 同じ雰囲気が連続しないよう分散する。
 */

/** 投稿の時間帯スロット */
export type PostSlot = "morning" | "day" | "night" | "goodnight";

export const SLOT_LABEL: Record<PostSlot, string> = {
  morning: "朝投稿", day: "昼投稿", night: "夜投稿", goodnight: "Good night",
};

/** 系統（雰囲気） */
interface ThemeStyle {
  id: string;
  label: string;
  /** 生成時にヒントとして使う一言（extraInstructions へ追記する用） */
  hint: string;
}

const STYLES: ThemeStyle[] = [
  { id: "street",   label: "ストリート系",   hint: "現代的なモードストリート・自然光・実在感のある都市" },
  { id: "dark",     label: "ダーク系",       hint: "ダークラグジュアリー・重厚な陰影・上品なゴシックモード" },
  { id: "fantasy",  label: "幻想系",         hint: "幻想的な光・透明感・neon に頼らない繊細な演出" },
  { id: "pale",     label: "淡色系",         hint: "淡色トーン・ワントーン配色・柔らかい自然光" },
  { id: "luxe",     label: "高級広告系",     hint: "高級ファッション広告・エディトリアル・洗練された構図" },
  { id: "wamodern", label: "和モダン系",     hint: "和モダン・落ち着いた配色・現代的な和の要素" },
  { id: "sporty",   label: "スポーツ系",     hint: "スポーツラグジュアリー・動きのある構図・クリーンな質感" },
  { id: "y2k",      label: "Y2K系",          hint: "Y2Kリバイバル・クロームや差し色・レトロポップ" },
];

/** スロットごとの雰囲気補正（時間帯に合う系統を優先しつつ全系統を回す） */
const SLOT_HINT: Record<PostSlot, string> = {
  morning: "朝の柔らかい光・清潔感・始まりの空気",
  day: "昼の明るい自然光・抜け感",
  night: "夜の照明・コントラスト・都会的な雰囲気",
  goodnight: "就寝前の落ち着いた雰囲気・暖色・穏やかな光",
};

export interface PostingDay {
  /** YYYY-MM-DD */
  dateKey: string;
  day: number;       // 1-31
  weekday: number;   // 0(日)-6(土)
  slot: PostSlot;
  slotLabel: string;
  styleId: string;
  styleLabel: string;
  /** 生成時に使うヒント文（時間帯＋系統） */
  hint: string;
}

const SLOT_ROTATION: PostSlot[] = ["morning", "night", "day", "goodnight"];

function pad2(n: number): string { return String(n).padStart(2, "0"); }

/**
 * year/month（month は 1-12）の各日に投稿テーマを割り当てて返す。
 * 決定的：日付インデックスでローテーションするため、同じ月なら毎回同じ結果。
 */
export function generatePostingCalendar(year: number, month: number): PostingDay[] {
  const daysInMonth = new Date(year, month, 0).getDate(); // month は 1-12
  const out: PostingDay[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d);
    const weekday = date.getDay();
    // スロット：4種をローテーション（週末の夜は night/goodnight を優先）
    let slot = SLOT_ROTATION[(d - 1) % SLOT_ROTATION.length];
    if ((weekday === 5 || weekday === 6) && slot === "day") slot = "night"; // 金土の昼→夜に寄せる
    // 系統：8種を素数ステップで回し、連続で同じにならないよう分散
    const styleIdx = (d * 3 + weekday) % STYLES.length;
    const style = STYLES[styleIdx];
    out.push({
      dateKey: `${year}-${pad2(month)}-${pad2(d)}`,
      day: d,
      weekday,
      slot,
      slotLabel: SLOT_LABEL[slot],
      styleId: style.id,
      styleLabel: style.label,
      hint: `${SLOT_HINT[slot]} / ${style.hint}`,
    });
  }
  return out;
}

/** 1日分のヒント文（extraInstructions へ追記する用） */
export function buildDayHint(day: PostingDay): string {
  return `[投稿テーマ ${day.dateKey}] ${day.slotLabel}・${day.styleLabel}：${day.hint}`;
}
