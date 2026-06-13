/**
 * マンネリ回避エンジン（Variety Engine）
 *
 * 目的：似た背景・衣装・色・構図・演出が繰り返し出力されるのを防ぐ。
 *
 * 設計思想：
 *  - 「単純ランダム禁止」。コード側でジャンルを抽選し、直近履歴・同系統連続を回避する。
 *  - 各案に1ジャンルを割り当て、UNFIXED軸（ユーザーが auto/skip にした軸）にのみ適用する。
 *    ユーザーが明示固定した軸は尊重し、上書きしない。
 *  - 神引き（viralMode）時は2〜4ジャンル融合に格上げする。
 *  - 毎回「意外性のひとさじ」を1案ごとに混ぜる。
 *
 * 状態管理：
 *  サーバはステートレスのため、直近に使ったジャンルは req.recentGenres
 *  （クライアントが localStorage で保持し往復させる）で受け取る。
 *  抽選結果のジャンルは GeneratedProposal.genre として返し、次回の recentGenres になる。
 */
import type { GenerateRequest } from "./types.ts";

export interface GenreDef {
  id: string;
  label: string;
  /** そのジャンルらしさを出すための要素ヒント（プロンプトに展開） */
  hint: string;
  /** 同系統連続回避用のファミリー。同一ファミリーは1バッチ内で重複させない。 */
  family: string;
}

/**
 * ジャンルプール（22種）。
 * 背景単体ではなく「衣装・色・構図・光・空気感」を含む総合的な美的方向性。
 */
export const GENRE_POOL: readonly GenreDef[] = [
  { id: "luxury_fashion", label: "高級ファッション広告", family: "fashion",
    hint: "ハイブランド広告の洗練・余白・上質な素材感・エディトリアルな構図" },
  { id: "apparel_lookbook", label: "アパレルLOOKBOOK", family: "fashion",
    hint: "ブランドルックブックの自然光・抜け感・着こなし主役・等身大のリアリティ" },
  { id: "sports_luxe", label: "スポーツラグジュアリー", family: "fashion",
    hint: "アスレジャーの機能美・テック素材・動きのあるダイナミズム・都会的洗練" },

  { id: "magazine_cover", label: "雑誌表紙", family: "editorial",
    hint: "表紙構図・タイトルスペースを意識した余白・視線誘導・強い主題性" },
  { id: "movie_poster", label: "映画ポスター", family: "editorial",
    hint: "劇的なライティングと構図・物語性・キービジュアル的な緊張感と余白" },
  { id: "ad_visual", label: "広告ビジュアル", family: "editorial",
    hint: "商業広告の訴求力・クリーンな完成度・明快なコンセプト・キャンペーン感" },
  { id: "idol_mv", label: "アイドルMV", family: "editorial",
    hint: "MVのワンシーン・色鮮やかな照明演出・ステージ感・キャッチーな華やかさ" },

  { id: "contemporary_art", label: "現代アート", family: "art",
    hint: "現代美術の知的な静謐・抽象性・コンセプチュアルな空間・前衛的な表現" },
  { id: "museum", label: "美術館展示", family: "art",
    hint: "ホワイトキューブ・展示照明・静けさ・作品として鑑賞される構え" },
  { id: "concept_art", label: "コンセプトアート", family: "art",
    hint: "ゲーム/映画のコンセプトアート・世界観の密度・劇的なスケール感と光" },

  { id: "underwater", label: "水中幻想", family: "nature",
    hint: "水中の浮遊感・揺らめく光・気泡・髪と布のたゆたい・幻想的な青の層" },
  { id: "greenhouse", label: "温室植物園", family: "nature",
    hint: "ガラス越しの拡散光・植物の緑と湿度・有機的な空間・柔らかな陰影" },
  { id: "snow", label: "雪景色", family: "nature",
    hint: "雪の白・吐息・凛とした冷気・静寂・寒色の透明感と防寒の質感" },

  { id: "minimal_white", label: "白背景ミニマル", family: "studio",
    hint: "純白の無地空間・極限の引き算・被写体と余白の緊張・クリーンな影" },
  { id: "interior", label: "インテリア写真", family: "studio",
    hint: "上質なインテリア空間・家具と光の調和・生活感のある洗練・自然光" },
  { id: "architecture", label: "建築写真", family: "studio",
    hint: "建築のシャープな直線・対称・幾何学・コンクリ/ガラス/光の構造美" },

  { id: "street", label: "ストリート", family: "urban",
    hint: "都市のエッジ・スナップ感・リアルな街の質感・カジュアルな動き" },

  { id: "retro", label: "レトロ", family: "retro",
    hint: "フィルム粒子・昭和〜80年代の色味・ノスタルジー・アナログな温度感" },
  { id: "retro_future", label: "レトロフューチャー", family: "retro",
    hint: "スペースエイジ・アトムパンク・50〜80年代が描いた未来観・楽観的SF" },

  { id: "wa_modern", label: "和モダン", family: "japanese",
    hint: "和の様式美と現代デザインの融合・墨と余白・自然素材・静かな品" },

  { id: "gothic_mode", label: "ゴシックモード", family: "dark",
    hint: "ゴシックの耽美をモードに昇華・構築的シルエット・闇と上質・退廃美" },

  { id: "industrial", label: "工業地帯", family: "industrial",
    hint: "工場/倉庫/鉄骨の無骨さ・金属とコンクリ・荒れた質感とハードな光" },
];

const GENRE_BY_ID: Record<string, GenreDef> = Object.fromEntries(
  GENRE_POOL.map((g) => [g.id, g])
);

/**
 * 意外性エンジン用の「ひとさじ」プール。
 * 通常は組み合わないツイストを1案ごとに混ぜ、「その発想はなかった」を狙う。
 */
const SURPRISE_TWISTS: readonly string[] = [
  "高級感のある被写体を、あえて工業地帯・無機質な空間に置く異物感",
  "和の要素と近未来的なテクノロジーを同居させる時間軸のズレ",
  "華やかな装いを、生活感のある日常空間に落とし込むギャップ",
  "静かでミニマルな画面に、張り詰めた静寂と緊張感（時が止まったような空気）を効かせる",
  "背後からの逆光シルエットで切り取る視点の逆転",
  "レトロな質感に、ホログラフィック／デジタルな演出を重ねる時代の衝突",
  "巨大なオブジェ（ぬいぐるみ・彫刻・日用品）を不自然な大きさで配置する超現実",
  "ストリートの被写体を、高級ホテル／美術館のような場違いな格式に置く",
  "自然（植物・水・雪）と人工（金属・ガラス・回路）を境界なく溶かす",
  "明るくポップな色彩に、ほんの少しビターな影とノスタルジックな哀愁を忍ばせる",
  "被写体を主役にしつつ、画面の主役級の存在感を持つ影／反射を共演させる",
  "広告的なクリーンさの中に、わざと1つだけノイズ・歪み・不協和を残す",
  "重力を感じさせない浮遊・落下の途中を、静止画として切り取る",
  "極端な接写（マクロ）と引きの広角を、1枚の中で意識させる視点の振れ幅",
  "昼と夜・暖色と寒色など、相反する光を1画面で衝突させる",
  "懐かしさと未来感を同時に喚起する、どの時代でもない無時間的な空気",
];

/**
 * 頻出要素ペナルティ。
 * 使用可能だが出現率を大幅に下げ、連続使用を禁止する要素。
 */
export const PENALTY_ELEMENTS: readonly string[] = [
  "ネオン街", "サイバーパンク都市", "近未来都市", "剣", "刀", "花びら",
  "発光粒子", "黒ゴシックドレス", "ロングコート", "地下駐車場",
  "ビル屋上", "クリスタル", "ホログラムパネル",
];

/**
 * マンネリ回避エンジン（ジャンル抽選）を適用してよい条件。
 *
 * ジャンル＝世界観・美的方向性なので、背景/前景/衣装/コスプレ/大物/乗り物/神話 など
 * 「シーンを規定する軸」が変更対象に入っているとき、または神引き時にのみ適用する。
 * 髪だけ・カメラだけ・ライティングだけ等の狭い部分編集では、シーンを変えてはいけない
 * （固定軸の維持に反する）ため適用しない。
 */
const SCENE_SCOPES: ReadonlySet<string> = new Set([
  "background", "foreground", "outfit", "cosplay", "big_object", "vehicle", "myth",
]);

export function shouldApplyVariety(req: GenerateRequest): boolean {
  if (req.viralMode === true) return true;
  return req.scopes.some((s) => SCENE_SCOPES.has(s));
}

// ── 抽選ロジック ──────────────────────────────────────────────────────────────

/** Fisher–Yates シャッフル（サーバ実行時なので Math.random 使用可）。 */
function shuffle<T>(arr: readonly T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export interface BatchPlanItem {
  genreId: string;
  genreLabel: string;
  /** 神引き時の追加融合ジャンル（通常時は空配列） */
  fusionLabels: string[];
  /** その案に混ぜる意外性のひとさじ */
  surprise: string;
}

export interface BatchPlan {
  items: BatchPlanItem[];
  godDraw: boolean;
  /** 直近で使われたため今回避けたジャンルのラベル（プロンプト明示用） */
  avoidedLabels: string[];
}

/**
 * バッチ全体のジャンル割り当てを抽選する。
 *  - 直近使用ジャンル（recentGenres）を最優先で回避
 *  - 同一ファミリー（同系統）を1バッチ内で重複させない
 *  - 案数に足りなければ段階的に制約を緩める（必ず count 件返す）
 */
export function planBatch(req: GenerateRequest): BatchPlan {
  const count = Math.max(1, req.count);
  const recentIds = new Set((req.recentGenres ?? []).map(String));
  const godDraw = req.viralMode === true;

  const avoidedLabels = (req.recentGenres ?? [])
    .map((id) => GENRE_BY_ID[id]?.label)
    .filter((v): v is string => Boolean(v));

  // 直近未使用を優先、その後に直近使用分を回す
  const fresh = shuffle(GENRE_POOL.filter((g) => !recentIds.has(g.id)));
  const stale = shuffle(GENRE_POOL.filter((g) => recentIds.has(g.id)));
  const ordered = [...fresh, ...stale];

  // 1パス目：ファミリー重複を避けて選ぶ
  const picked: GenreDef[] = [];
  const usedFamilies = new Set<string>();
  for (const g of ordered) {
    if (picked.length >= count) break;
    if (usedFamilies.has(g.family)) continue;
    picked.push(g);
    usedFamilies.add(g.family);
  }
  // 2パス目：ファミリー制約を外して充足（ジャンル自体の重複は避ける）
  if (picked.length < count) {
    for (const g of ordered) {
      if (picked.length >= count) break;
      if (picked.some((p) => p.id === g.id)) continue;
      picked.push(g);
    }
  }
  // 3パス目：それでも足りない極端ケースは循環で埋める
  while (picked.length < count) {
    picked.push(ordered[picked.length % ordered.length]);
  }

  const twists = shuffle(SURPRISE_TWISTS);

  const items: BatchPlanItem[] = picked.map((g, i) => {
    let fusionLabels: string[] = [];
    if (godDraw) {
      // 神引き：別ファミリーから1〜3ジャンルを融合
      const others = shuffle(
        GENRE_POOL.filter((o) => o.family !== g.family && o.id !== g.id)
      );
      const k = 1 + (i % 3); // 1〜3
      fusionLabels = others.slice(0, k).map((o) => o.label);
    }
    return {
      genreId: g.id,
      genreLabel: g.label,
      fusionLabels,
      surprise: twists[i % twists.length],
    };
  });

  return { items, godDraw, avoidedLabels };
}

// ── プロンプトブロック生成 ────────────────────────────────────────────────────

/**
 * マンネリ回避エンジンの指示ブロックを生成する。
 * buildSystemPrompt から挿入される。
 */
export function varietyBlock(plan: BatchPlan, req: GenerateRequest): string {
  const lines: string[] = [];

  lines.push("【マンネリ回避エンジン — 最重要・絶対遵守】");
  lines.push(
    "目的：似た背景・衣装・色・構図・演出の繰り返しを根絶し、毎回新鮮な絵を出す。"
  );
  lines.push("豪華さより『意外性・組み合わせ・発見性』を優先する。");
  lines.push("");

  // ── ジャンル割り当て ──────────────────────────────────────────────────────
  if (plan.godDraw) {
    lines.push(
      "▼ 神引きモード：各案は下記の『2〜4ジャンル融合』を核に構築する（異ジャンル衝突を恐れない）："
    );
    plan.items.forEach((it, i) => {
      const fusion = [it.genreLabel, ...it.fusionLabels].join(" ＋ ");
      lines.push(`  案${i + 1}：${fusion}`);
    });
  } else {
    lines.push(
      "▼ ジャンル割り当て（各案に異なる美的方向性を内部抽選済み。下記を核にする）："
    );
    plan.items.forEach((it, i) => {
      const def = GENRE_BY_ID[it.genreId];
      const hint = def ? `（${def.hint}）` : "";
      lines.push(`  案${i + 1}：${it.genreLabel}${hint}`);
    });
  }
  lines.push("");
  lines.push(
    "  ※ジャンルは『方向性』。ユーザーが明示固定した軸（具体指定された衣装・背景・色等）は" +
    "そのまま尊重し、ユーザーが未指定（おまかせ/auto）の軸にのみこのジャンル性を反映する。"
  );
  lines.push(
    "  ※各案のジャンルは互いに明確に異質であること。隣り合う案で似た世界観・色調にしない。"
  );
  lines.push("");

  // ── 意外性のひとさじ ──────────────────────────────────────────────────────
  lines.push("▼ 意外性エンジン（各案に最低1つ、通常は組み合わない要素を混ぜる）：");
  plan.items.forEach((it, i) => {
    lines.push(`  案${i + 1}：${it.surprise}`);
  });
  lines.push("");

  // ── 直近回避 ──────────────────────────────────────────────────────────────
  if (plan.avoidedLabels.length > 0) {
    lines.push(
      "▼ 直近の生成で既に使った方向性（今回は連続を避け、別方向に振る）：" +
      plan.avoidedLabels.join("・")
    );
    lines.push("");
  }

  // ── 頻出要素ペナルティ ────────────────────────────────────────────────────
  lines.push("▼ 頻出要素ペナルティ（使用可だが出現率を大幅に下げ、連続使用禁止）：");
  lines.push("  " + PENALTY_ELEMENTS.join(" / "));
  lines.push(
    "  これらは全案合計で最大1回まで。神引きでも乱発しない。" +
    "代わりに上記ジャンル性・光・質感・空間・構図で魅せること。"
  );
  lines.push("");

  // ── 背景依存率の低減 ──────────────────────────────────────────────────────
  lines.push("▼ 背景依存率の低減（背景の豪華さだけに頼らない）：");
  lines.push(
    "  背景がシンプル（白・無地・ぼけ）でも成立する構成を増やす。" +
    "今回の変更対象の軸（衣装・構図・小物など選択された範囲）でまず強さを作ってから背景を足す。"
  );
  lines.push("");

  // ── ポーズ強化（pose スコープ選択時のみ。未選択時はポーズ維持が必須なので出さない） ──
  if (req.scopes.includes("pose")) {
    lines.push("▼ ポーズの多様性（静止立ち偏重を避けつつ、落ち着いた自然な動きで案ごとに変える）：");
    lines.push(
      "  歩行中 / 振り向き / 軽く座る / 椅子にもたれる / 片脚に重心を預けて立つ / 体重を片脚にかける /"
    );
    lines.push(
      "  腰に手を添える / 軽く髪に触れる / 軽く前傾 / 視線を外す / 肩ごしの視線 / 手元の所作"
    );
    lines.push("  各案でポーズの方向性を明確に変える。所作は健全でファッション誌的な範囲に保ち、媚び・体の強調に寄せない。");
    lines.push("  ポーズ自体は自然な目線で成立する範囲に収め、極端な俯瞰・煽りを前提にしない。");
    lines.push("");
  }

  // ── 多軸ミックス（おまかせ/ランダム/神引き時） ────────────────────────────
  lines.push(
    "▼ 多軸ミックス：おまかせ/ランダム/神引きで自由に決めてよい軸は、" +
    "1個固定ではなく1〜3個を組み合わせて厚みを出す"
  );
  lines.push(
    "  （例：背景2 / 衣装3 / 演出2 / 色構成3 / 神話1 のように軸ごとに数を変える）。" +
    "ただし今回の変更対象に含まれない軸は対象外。"
  );
  lines.push("");

  // ── 最終自己チェック ──────────────────────────────────────────────────────
  lines.push("▼ 最終自己チェック（出力前に必ず確認）：");
  lines.push(
    "  □ 各案は互いに明確に異なるか。変更対象の軸内（衣装なら素材・色・シルエット・装飾、" +
    "背景なら場所・色・空気感・構図など）で可能な限り3点以上を差別化する。"
  );
  lines.push(
    "  □ スコープ外・固定軸（顔・体型、及び今回変更対象でない背景/ポーズ/カメラ等）は" +
    "変えていないか。"
  );
  lines.push("  □ 直近で使った方向性・頻出要素を不用意に繰り返していないか。");
  lines.push("  □ 各案に『その発想はなかった』と思える一手があるか。");

  return lines.join("\n");
}
