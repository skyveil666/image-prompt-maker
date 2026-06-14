/**
 * お気に入り解除の確認ダイアログ。OK を押したら true を返す。
 *
 * 文言を1ソースに集約する目的（HistoryItemRow で使用）。
 * お気に入りフラグの誤操作によるデータ喪失を防ぐためのガード。
 */
export function confirmUnfavorite(): boolean {
  return window.confirm("お気に入りを解除しますか？");
}
