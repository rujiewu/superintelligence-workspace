/* Private browser navigation preferences and Learning review dates; never answers or history.
   Review state stays in this browser's localStorage (ADR 0076): status plus the next review
   date from the catalog rule (about one week after learning, about one month after review). */
window.HUB_WORKSPACE_STATE = (storage) => {
  const modules = new Set(["reading", "learning", "trading", "investment"]);
  const identity = value => typeof value === "string" && /^[a-z0-9_-]{1,160}$/.test(value);
  const read = key => {
    try { return storage().getItem(key); } catch { return null; }
  };
  const write = (key, value) => {
    try { storage().setItem(key, value); } catch { /* Navigation still works. */ }
  };
  const lastKey = module => `hub-last-material-v1:${module}`;
  const sectionKey = (module, resource) => `hub-section-v1:${module}:${resource}`;
  const reviewKey = resource => `hub-learning-review-v1:${resource}`;
  const statuses = Object.freeze({ new: 0, learning: 7, reviewed: 30, mastered: null });
  const isoDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || "");
  const addDays = (day, days) => {
    const [y, m, d] = day.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
  };
  return Object.freeze({
    initial(module, ids, requested, fallback) {
      if (requested && ids.includes(requested)) return requested;
      const saved = modules.has(module) && !requested ? read(lastKey(module)) : null;
      return ids.includes(saved) ? saved : ids.includes(fallback) ? fallback : ids[0];
    },
    remember(module, resource) {
      if (modules.has(module) && identity(resource)) {
        write(lastKey(module), resource);
        window.HUB_REMOTE?.rememberNavigation?.(module, resource);
      }
    },
    section(module, resource) {
      if (!modules.has(module) || !identity(resource)) return null;
      const saved = read(sectionKey(module, resource));
      return typeof saved === "string" && saved.length <= 500 ? saved : null;
    },
    rememberSection(module, resource, section) {
      if (modules.has(module) && identity(resource) && typeof section === "string"
          && section.length <= 500 && section !== read(sectionKey(module, resource))) {
        write(sectionKey(module, resource), section);
        window.HUB_REMOTE?.rememberNavigation?.(module, resource, section);
      }
    },
    review(resource, today) {
      if (!identity(resource)) return null;
      let saved = null;
      try { saved = JSON.parse(read(reviewKey(resource)) || "null"); } catch { saved = null; }
      if (!saved || !Object.hasOwn(statuses, saved.status)) return { status: "new", next: null, due: false };
      const next = isoDate(saved.next) ? saved.next : null;
      return { status: saved.status, next, due: Boolean(next && isoDate(today) && next <= today) };
    },
    setReview(resource, status, today) {
      if (!identity(resource) || !Object.hasOwn(statuses, status) || !isoDate(today)) return null;
      const days = statuses[status];
      const record = { status, next: days ? addDays(today, days) : null, updated: today };
      if (status === "new") {
        try { storage().removeItem(reviewKey(resource)); } catch { /* Navigation still works. */ }
      } else {
        write(reviewKey(resource), JSON.stringify(record));
      }
      return this.review(resource, today);
    },
    dueReviews(ids, today) {
      return ids.filter(id => this.review(id, today)?.due);
    },
    focus() { return read("hub-focus-v1") === "true"; },
    setFocus(enabled) { write("hub-focus-v1", String(Boolean(enabled))); },
  });
};
