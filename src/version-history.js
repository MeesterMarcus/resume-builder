export class VersionHistory {
  constructor(storageKey, maxEntries = 10, initialEntries = null) {
    this.storageKey = storageKey;
    this.maxEntries = maxEntries;
    this.entries = initialEntries ?? this.load();
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
    if (!this.storageKey) return;
    localStorage.setItem(this.storageKey, JSON.stringify(this.entries));
  }

  snapshot({ data, documentName, theme, layout, textScale, label }, force = false) {
    const serializedState = JSON.stringify({ data, documentName, theme, layout, textScale });
    const latestState = this.entries[0]
      ? JSON.stringify({
          data: this.entries[0].data,
          documentName: this.entries[0].documentName,
          theme: this.entries[0].theme,
          layout: this.entries[0].layout,
          textScale: this.entries[0].textScale,
        })
      : null;
    if (!force && serializedState === latestState) return false;

    this.entries.unshift({
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      label,
      data: JSON.parse(JSON.stringify(data)),
      documentName,
      theme,
      layout,
      textScale,
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
