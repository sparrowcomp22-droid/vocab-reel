// localStorage永続化レイヤー。プリセットカード(静的JSON)とユーザー追加カードを分離し、
// 復習進捗(SRS状態)はカードIDをキーに別管理する。
const DB = (() => {
  const KEYS = {
    custom: 'vocabreel.customCards',
    edits: 'vocabreel.presetEdits',
    deleted: 'vocabreel.deletedPresets',
    progress: 'vocabreel.progress',
    settings: 'vocabreel.settings',
    streak: 'vocabreel.streak'
  };

  let presetCards = [];

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  async function init() {
    try {
      const res = await fetch('data/preset-deck.json');
      presetCards = await res.json();
    } catch (e) {
      presetCards = [];
    }
  }

  function getCustomCards() {
    return readJSON(KEYS.custom, []);
  }

  function getPresetEdits() {
    return readJSON(KEYS.edits, {});
  }

  function getDeletedPresetIds() {
    return readJSON(KEYS.deleted, []);
  }

  function getAllCards() {
    const deleted = new Set(getDeletedPresetIds());
    const edits = getPresetEdits();
    const presets = presetCards
      .filter(c => !deleted.has(c.id))
      .map(c => (edits[c.id] ? { ...c, ...edits[c.id] } : c));
    const custom = getCustomCards();
    return [...presets, ...custom];
  }

  function isPresetId(id) {
    return presetCards.some(c => c.id === id);
  }

  function addCard(card) {
    const cards = getCustomCards();
    const id = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const newCard = { ...card, id };
    cards.push(newCard);
    writeJSON(KEYS.custom, cards);
    return newCard;
  }

  function updateCard(id, patch) {
    if (isPresetId(id)) {
      const edits = getPresetEdits();
      edits[id] = { ...(edits[id] || {}), ...patch };
      writeJSON(KEYS.edits, edits);
    } else {
      const cards = getCustomCards().map(c => (c.id === id ? { ...c, ...patch } : c));
      writeJSON(KEYS.custom, cards);
    }
  }

  function deleteCard(id) {
    if (isPresetId(id)) {
      const deleted = getDeletedPresetIds();
      if (!deleted.includes(id)) deleted.push(id);
      writeJSON(KEYS.deleted, deleted);
    } else {
      const cards = getCustomCards().filter(c => c.id !== id);
      writeJSON(KEYS.custom, cards);
    }
    const progress = readJSON(KEYS.progress, {});
    delete progress[id];
    writeJSON(KEYS.progress, progress);
  }

  function getAllProgress() {
    return readJSON(KEYS.progress, {});
  }

  function getProgress(id) {
    return getAllProgress()[id] || null;
  }

  function setProgress(id, progress) {
    const all = getAllProgress();
    all[id] = progress;
    writeJSON(KEYS.progress, all);
  }

  function getSettings() {
    return readJSON(KEYS.settings, { threshold: 0.75 });
  }

  function setSettings(settings) {
    writeJSON(KEYS.settings, settings);
  }

  function getStreak() {
    return readJSON(KEYS.streak, { count: 0, lastReviewDate: null });
  }

  function bumpStreak() {
    const streak = getStreak();
    const today = SRS.todayStr();
    if (streak.lastReviewDate === today) {
      return streak;
    }
    const yesterday = SRS.addDays(today, -1);
    const count = streak.lastReviewDate === yesterday ? streak.count + 1 : 1;
    const updated = { count, lastReviewDate: today };
    writeJSON(KEYS.streak, updated);
    return updated;
  }

  return {
    init,
    getAllCards,
    addCard,
    updateCard,
    deleteCard,
    getProgress,
    setProgress,
    getSettings,
    setSettings,
    getStreak,
    bumpStreak
  };
})();
