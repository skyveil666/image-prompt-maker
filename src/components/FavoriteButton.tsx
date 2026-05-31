interface Props {
  active: boolean;
  onToggle: () => void;
}

export function FavoriteButton({ active, onToggle }: Props) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={[
        "inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold border transition-all duration-200",
        active
          ? "border-amber-300/70 bg-gradient-to-r from-amber-400/30 to-yellow-300/20 text-amber-100 shadow-[0_0_12px_rgba(251,191,36,0.3)] scale-[1.02]"
          : "border-amber-300/25 bg-amber-300/5 text-amber-200/65 hover:bg-amber-300/15 hover:border-amber-300/50 hover:text-amber-200",
      ].join(" ")}
      title={active ? "お気に入りを解除" : "お気に入りに追加"}
    >
      <span className="text-sm leading-none">{active ? "⭐" : "☆"}</span>
      <span>{active ? "お気に入り済み" : "お気に入り"}</span>
    </button>
  );
}
