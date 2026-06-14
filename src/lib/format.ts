/** タイムスタンプを "YYYY/MM/DD HH:mm"（ローカル時刻）に整形する。 */
export function formatDateTime(ts: number): string {
  const d = new Date(ts);
  return (
    `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ` +
    `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
  );
}
