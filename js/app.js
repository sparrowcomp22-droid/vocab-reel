(() => {
  const TAG_LABEL = { video: '映像制作', business: 'ビジネス', daily: '日常会話', hunting: '狩猟' };

  const state = {
    homeTag: 'all',
    manageTag: 'all',
    manageQuery: '',
    reviewQueue: [],
    reviewIndex: 0,
    reviewCorrect: 0,
    flipped: false,
    editingId: null
  };

  const $ = sel => document.querySelector(sel);
  const views = {};
  document.querySelectorAll('.view').forEach(v => { views[v.dataset.view] = v; });

  function showView(name) {
    Object.values(views).forEach(v => v.classList.add('hidden'));
    views[name].classList.remove('hidden');
  }

  // ---------- clock (timecode HUD flourish) ----------
  function tickClock() {
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    const ff = String(Math.floor(d.getMilliseconds() / 42)).padStart(2, '0');
    $('#hud-clock').textContent = `${hh}:${mm}:${ss}:${ff}`;
  }

  // ---------- card helpers ----------
  function withProgress(card) {
    return { ...card, progress: DB.getProgress(card.id) || SRS.createProgress() };
  }

  function getCardsByTag(tag) {
    const all = DB.getAllCards().map(withProgress);
    return tag === 'all' ? all : all.filter(c => c.tag === tag);
  }

  function getDueCards(tag) {
    return getCardsByTag(tag).filter(c => SRS.isDue(c.progress));
  }

  // ---------- HOME ----------
  function renderHome() {
    const streak = DB.getStreak();
    $('#stat-streak').textContent = streak.count;
    $('#stat-total').textContent = DB.getAllCards().length;

    const due = getDueCards(state.homeTag);
    $('#stat-due').textContent = due.length;
    $('#btn-review-sub').textContent = `${due.length} CARDS DUE`;
    $('#btn-start-review').disabled = due.length === 0;
    $('#btn-start-review').style.opacity = due.length === 0 ? 0.5 : 1;
  }

  document.querySelectorAll('#tag-filter .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('#tag-filter .chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.homeTag = chip.dataset.tag;
      renderHome();
    });
  });

  $('#btn-start-review').addEventListener('click', () => {
    TTS.unlock();
    const due = getDueCards(state.homeTag);
    if (!due.length) return;
    state.reviewQueue = due.sort(() => Math.random() - 0.5);
    state.reviewIndex = 0;
    state.reviewCorrect = 0;
    showView('review');
    renderReviewCard();
  });

  $('#btn-manage').addEventListener('click', () => { showView('manage'); renderManageList(); });
  $('#btn-settings').addEventListener('click', () => { showView('settings'); renderSettings(); });

  // ---------- REVIEW ----------
  function currentCard() {
    return state.reviewQueue[state.reviewIndex];
  }

  function renderReviewCard() {
    const card = currentCard();
    state.flipped = false;

    const total = state.reviewQueue.length;
    $('#review-progress-text').textContent =
      `${String(state.reviewIndex + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;
    $('#review-progress-fill').style.width = `${(state.reviewIndex / total) * 100}%`;

    $('#card-tag').textContent = TAG_LABEL[card.tag] || card.tag;
    $('#card-en').textContent = card.en;
    $('#card-ipa').textContent = card.ipa || '';
    $('#card-ja').textContent = card.ja;
    $('#card-example').textContent = card.example || '';

    $('#card-back').classList.add('hidden');
    document.querySelector('.card-front').classList.remove('hidden');
    $('#review-actions').classList.add('hidden');

    $('#pronounce-input').value = '';
    $('#pronounce-result').classList.add('hidden');
  }

  function flipCard() {
    if (state.flipped) return;
    state.flipped = true;
    document.querySelector('.card-front').classList.add('hidden');
    $('#card-back').classList.remove('hidden');
    $('#review-actions').classList.remove('hidden');
  }

  document.querySelector('.card-front').addEventListener('click', flipCard);

  $('#btn-speak-front').addEventListener('click', e => {
    e.stopPropagation();
    TTS.speak(currentCard().en);
  });
  $('#btn-speak-back').addEventListener('click', () => {
    TTS.speak(currentCard().en);
  });

  $('#btn-check-pronounce').addEventListener('click', async () => {
    const card = currentCard();
    const spoken = $('#pronounce-input').value;
    const settings = DB.getSettings();
    const result = await Pronunciation.checkPronunciation(spoken, card.en, settings.threshold);
    $('#pronounce-result').classList.remove('hidden');
    $('#pronounce-score-fill').style.width = `${result.percent}%`;
    $('#pronounce-score-fill').style.background = result.pass ? 'var(--green)' : 'var(--red)';
    $('#pronounce-score-text').textContent =
      `一致度 ${result.percent}%  ${result.pass ? '✓ 合格' : '✕ もう一度'}`;
  });

  function advanceReview(remembered) {
    const card = currentCard();
    const updated = SRS.review(card.progress, remembered);
    DB.setProgress(card.id, updated);
    if (remembered) state.reviewCorrect++;

    if (state.reviewIndex + 1 >= state.reviewQueue.length) {
      finishReview();
    } else {
      state.reviewIndex++;
      renderReviewCard();
    }
  }

  $('#btn-forgot').addEventListener('click', () => advanceReview(false));
  $('#btn-remembered').addEventListener('click', () => advanceReview(true));
  $('#btn-exit-review').addEventListener('click', () => { showView('home'); renderHome(); });

  function finishReview() {
    const streak = DB.bumpStreak();
    const total = state.reviewQueue.length;
    const accuracy = total ? Math.round((state.reviewCorrect / total) * 100) : 0;

    $('#complete-count').textContent = total;
    $('#complete-accuracy').textContent = accuracy;
    $('#complete-streak').textContent = streak.count;
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    $('#complete-timecode').textContent = `${hh}:${mm}:${ss}:00`;
    showView('complete');
  }

  $('#btn-complete-home').addEventListener('click', () => { showView('home'); renderHome(); });

  // ---------- MANAGE ----------
  function renderManageList() {
    const list = $('#manage-list');
    list.innerHTML = '';
    const q = state.manageQuery.trim().toLowerCase();
    let cards = getCardsByTag(state.manageTag);
    if (q) {
      cards = cards.filter(c =>
        c.en.toLowerCase().includes(q) || c.ja.toLowerCase().includes(q));
    }
    cards.forEach(card => {
      const item = document.createElement('div');
      item.className = 'manage-item';
      const due = SRS.isDue(card.progress);
      item.innerHTML = `
        <div class="manage-item-main">
          <div class="manage-item-en">${escapeHtml(card.en)}</div>
          <div class="manage-item-ja">${escapeHtml(card.ja)}</div>
          <div class="manage-item-due ${due ? 'due' : ''}">${due ? '復習期限: 今日' : '次回: ' + card.progress.dueDate}</div>
        </div>
      `;
      item.addEventListener('click', () => openEdit(card.id));
      list.appendChild(item);
    });
  }

  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  document.querySelectorAll('#manage-tag-filter .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('#manage-tag-filter .chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.manageTag = chip.dataset.tag;
      renderManageList();
    });
  });

  $('#manage-search').addEventListener('input', e => {
    state.manageQuery = e.target.value;
    renderManageList();
  });

  $('#btn-manage-back').addEventListener('click', () => { showView('home'); renderHome(); });
  $('#btn-add-card').addEventListener('click', () => openEdit(null));

  // ---------- EDIT / ADD ----------
  function openEdit(id) {
    state.editingId = id;
    const form = $('#edit-form');
    form.reset();
    if (id) {
      const card = DB.getAllCards().find(c => c.id === id);
      $('#edit-title').textContent = 'カード編集';
      $('#edit-en').value = card.en;
      $('#edit-ja').value = card.ja;
      $('#edit-example').value = card.example || '';
      $('#edit-ipa').value = card.ipa || '';
      $('#edit-tag').value = card.tag;
      $('#btn-delete-card').classList.remove('hidden');
    } else {
      $('#edit-title').textContent = '新規カード';
      $('#btn-delete-card').classList.add('hidden');
    }
    showView('edit');
  }

  $('#edit-form').addEventListener('submit', e => {
    e.preventDefault();
    const data = {
      en: $('#edit-en').value.trim(),
      ja: $('#edit-ja').value.trim(),
      example: $('#edit-example').value.trim(),
      ipa: $('#edit-ipa').value.trim(),
      tag: $('#edit-tag').value
    };
    if (!data.en || !data.ja) return;

    if (state.editingId) {
      DB.updateCard(state.editingId, data);
    } else {
      DB.addCard(data);
    }
    showView('manage');
    renderManageList();
    renderHome();
  });

  $('#btn-edit-cancel').addEventListener('click', () => { showView('manage'); renderManageList(); });

  $('#btn-delete-card').addEventListener('click', () => {
    if (!state.editingId) return;
    if (!confirm('このカードを削除しますか?')) return;
    DB.deleteCard(state.editingId);
    showView('manage');
    renderManageList();
    renderHome();
  });

  // ---------- SETTINGS ----------
  function renderSettings() {
    const settings = DB.getSettings();
    const pct = Math.round(settings.threshold * 100);
    $('#threshold-slider').value = pct;
    $('#threshold-value').textContent = pct;
  }

  $('#threshold-slider').addEventListener('input', e => {
    $('#threshold-value').textContent = e.target.value;
    DB.setSettings({ threshold: Number(e.target.value) / 100 });
  });

  $('#btn-settings-back').addEventListener('click', () => { showView('home'); renderHome(); });

  // ---------- INIT ----------
  async function boot() {
    await DB.init();
    tickClock();
    setInterval(tickClock, 250);
    renderHome();
    showView('home');

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  boot();
})();
