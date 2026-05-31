export interface NotifSettings {
  sound:     boolean;
  toast:     boolean;
  tabTitle:  boolean;
  animation: boolean;
}

const KEY = "ipm_notif";

const DEFAULTS: NotifSettings = {
  sound:     true,
  toast:     true,
  tabTitle:  true,
  animation: true,
};

export function getNotifSettings(): NotifSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<NotifSettings>) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function setNotifSettings(s: NotifSettings): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
}
