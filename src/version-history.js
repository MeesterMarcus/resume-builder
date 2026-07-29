export class VersionHistory {
  constructor(storageKey, maxEntries = 10) {
    this.storageKey = storageKey;
    this.maxEntries = maxEntries;
    this.entries = this.load();
  }

  load() {
    try {
      const value = JSON.parse(localStorage.getItem(this.storageKey) ?? "[]");
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  save() {
    localStorage.setItem(this.storageKey, JSON.stringify(this.entries));
  }

  snapshot({ data, theme, label }, force = false) {
    const serializedState = JSON.stringify({ data, theme });
    const latestState = this.entries[0] ? JSON.stringify({ data: this.entries[0].data, theme: this.entries[0].theme }) : null;
    if (!force && serializedState === latestState) return false;

    this.entries.unshift({
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      label,
      data: JSON.parse(JSON.stringify(data)),
      theme,
    });
    this.entries = this.entries.slice(0, this.maxEntries);
    this.save();
    return true;
  }

  get(id) {
    return this.entries.find((entry) => entry.id === id) ?? null;
  }

  all() {
    return [...this.entries];
  }
}

