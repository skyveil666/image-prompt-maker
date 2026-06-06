import type { Mood } from "../types";
import { GridCell, CellSectionLabel, CellGrid } from "./GridCell";

// 注: 旧 `MoodSelector` コンポーネントは未使用のため削除（P4-P3）。
// 本ファイルは定数 MOOD_GROUPS_*・型 MoodGroup・MoodGroupRow・hasDetailSelection を
// DetailsCard / favoriteProfile が利用する共有モジュールとして存続する。

// ─── Category definitions ─────────────────────────────────────────────────────

export interface MoodGroup {
  label: string;
  moods: { id: Mood; label: string }[];
}

/** 常時表示する基本 6 カテゴリ */
export const MOOD_GROUPS_BASIC: MoodGroup[] = [
  {
    label: "基本",
    moods: [
      { id: "cool",      label: "クール"    },
      { id: "cute",      label: "かわいい"  },
      { id: "stylish",   label: "かっこいい"},
      { id: "emo",       label: "エモい"    },
      { id: "bright",    label: "明るめ"   },
      { id: "dark",      label: "ダーク"   },
      { id: "clean",     label: "清潔感"   },
      { id: "heavy",     label: "重厚感"   },
      { id: "ephemeral", label: "儚い"     },
    ],
  },
  {
    label: "世界観",
    moods: [
      { id: "near_future",   label: "近未来"        },
      { id: "cyberpunk",     label: "サイバーパンク" },
      { id: "japanese",      label: "和風"          },
      { id: "gothic",        label: "ゴシック"      },
      { id: "fantasy",       label: "幻想的"        },
      { id: "fantasy_world", label: "ファンタジー"   },
      { id: "wa_fantasy",    label: "和ファンタジー" },
      { id: "retro",         label: "レトロ"        },
      { id: "contemporary",  label: "現代美術"      },
      { id: "architectural", label: "建築的"        },
      { id: "urban_fantasy", label: "都市幻想"      },
      { id: "retro_future",  label: "レトロ未来"    },
    ],
  },
  {
    label: "演出",
    moods: [
      { id: "sns_pop",           label: "SNS映え"      },
      { id: "cinematic",         label: "映画風"       },
      { id: "glitch",            label: "グリッチ"     },
      { id: "noisy",             label: "ノイズ強め"   },
      { id: "translucent",       label: "透明感"       },
      { id: "digital",           label: "デジタル"     },
      { id: "preserve_bg_color", label: "元背景色活かす"},
      { id: "reflection_rich",   label: "反射多め"     },
      { id: "whitespace",        label: "余白活用"     },
      { id: "ad_visual",         label: "広告ビジュアル"},
      { id: "magazine_cover",    label: "雑誌表紙風"   },
      { id: "movie_poster",      label: "映画ポスター風"},
    ],
  },
  {
    label: "色味",
    moods: [
      { id: "monochrome", label: "モノクロ" },
      { id: "pastel",     label: "パステル" },
      { id: "vivid",      label: "ビビッド" },
      { id: "pop",        label: "ポップ"  },
      { id: "mystic",     label: "神秘的"  },
      { id: "art",        label: "アート系" },
    ],
  },
  {
    label: "SNS最適化",
    moods: [
      { id: "portrait",      label: "ポートレート"   },
      { id: "instagram",     label: "Instagram映え"  },
      { id: "tiktok",        label: "TikTok映え"    },
      { id: "pinterest",     label: "Pinterest映え"  },
      { id: "x_buzz",        label: "Xバズ"         },
      { id: "trend_2026",    label: "2026トレンド"   },
      { id: "thumbnail_pop", label: "サムネ映え"     },
      { id: "scroll_stop",   label: "スクロール停止" },
      { id: "icon_pop",      label: "アイコン映え"   },
    ],
  },
  {
    label: "その他",
    moods: [
      { id: "minimal",  label: "ミニマル"  },
      { id: "luxe",     label: "高級感"    },
      { id: "decadent", label: "退廃的"    },
      { id: "street",   label: "ストリート" },
    ],
  },
];

/** 折りたたみ内の詳細 4 カテゴリ */
export const MOOD_GROUPS_DETAIL: MoodGroup[] = [
  {
    label: "反射",
    moods: [
      { id: "refl_water",      label: "水面反射"   },
      { id: "refl_glass",      label: "ガラス反射" },
      { id: "refl_mirror",     label: "鏡面反射"   },
      { id: "refl_metal",      label: "金属反射"   },
      { id: "refl_wet_floor",  label: "濡れた床"   },
      { id: "refl_car_window", label: "車窓反射"   },
    ],
  },
  {
    label: "空気感",
    moods: [
      { id: "air_fog",             label: "霧"         },
      { id: "air_smoke",           label: "煙"         },
      { id: "air_after_rain",      label: "雨上がり"   },
      { id: "air_dust",            label: "粉塵"       },
      { id: "air_light_particles", label: "光の粒"     },
      { id: "air_humid",           label: "湿度感"     },
      { id: "air_cold",            label: "冷たい空気" },
    ],
  },
  {
    label: "色調",
    moods: [
      { id: "grade_cinema",   label: "シネマ調" },
      { id: "grade_ad",       label: "広告調"   },
      { id: "grade_low_sat",  label: "低彩度"   },
      { id: "grade_high_sat", label: "高彩度"   },
      { id: "grade_blue",     label: "青み"     },
      { id: "grade_red",      label: "赤み"     },
      { id: "grade_white",    label: "白基調"   },
      { id: "grade_black",    label: "黒基調"   },
    ],
  },
  {
    label: "空間",
    moods: [
      { id: "venue_wide",       label: "広い空間"   },
      { id: "venue_narrow",     label: "狭い空間"   },
      { id: "venue_gallery",    label: "展示空間"   },
      { id: "venue_hotel",      label: "ホテル"     },
      { id: "venue_greenhouse", label: "温室"       },
      { id: "venue_station",    label: "駅"         },
      { id: "venue_rooftop",    label: "屋上"       },
      { id: "venue_glass",      label: "ガラス空間" },
      { id: "venue_abstract",   label: "抽象空間"   },
    ],
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getGroupSelection(
  group: MoodGroup,
  moods: Mood[],
  autoMoodCategories: string[]
): "skip" | "auto" | Mood {
  const found = group.moods.find((m) => moods.includes(m.id));
  if (found) return found.id;
  if (autoMoodCategories.includes(group.label)) return "auto";
  return "skip";
}

/** 詳細カテゴリのいずれかに選択済みの値があるか判定（バッジ表示用） */
export function hasDetailSelection(moods: Mood[], autoMoodCategories: string[]): boolean {
  const detailLabels = MOOD_GROUPS_DETAIL.map((g) => g.label);
  if (detailLabels.some((l) => autoMoodCategories.includes(l))) return true;
  const detailMoodIds = MOOD_GROUPS_DETAIL.flatMap((g) => g.moods.map((m) => m.id));
  return detailMoodIds.some((id) => moods.includes(id));
}

// ─── MoodGroupRow ─────────────────────────────────────────────────────────────

export function MoodGroupRow({
  group,
  moods,
  autoMoodCategories,
  onSelect,
  noTopMargin = false,
}: {
  group: MoodGroup;
  moods: Mood[];
  autoMoodCategories: string[];
  onSelect: (group: MoodGroup, selection: "skip" | "auto" | Mood) => void;
  noTopMargin?: boolean;
}) {
  const current = getGroupSelection(group, moods, autoMoodCategories);
  return (
    <div>
      <CellSectionLabel label={group.label} noTopMargin={noTopMargin} compact />
      <CellGrid compact>
        <GridCell
          jaLabel="設定なし"
          cellKind="skip"
          active={current === "skip"}
          onClick={() => onSelect(group, "skip")}
          title="このカテゴリはプロンプトに反映しない"
          compact
        />
        <GridCell
          jaLabel="おまかせ"
          cellKind="auto"
          active={current === "auto"}
          onClick={() => onSelect(group, "auto")}
          title="AIが案ごとに自由に決める"
          compact
        />
        {group.moods.map((opt) => (
          <GridCell
            key={opt.id}
            jaLabel={opt.label}
            cellKind="value"
            active={current === opt.id}
            onClick={() => onSelect(group, opt.id)}
            compact
          />
        ))}
      </CellGrid>
    </div>
  );
}

// 旧 `MoodSelector` コンポーネントは未使用のため削除（P4-P3）。
// 雰囲気カテゴリの UI は DetailsCard 側が MoodGroupRow を直接使って描画する。
