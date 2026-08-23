// SM-2ベースの間隔反復アルゴリズム
const SRS = (() => {
  const DAY_MS = 24 * 60 * 60 * 1000;

  function formatLocal(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  // ローカルタイムの日付文字列で統一する(toISOStringはUTC変換されるため
  // JSTなど正のオフセットのタイムゾーンで日付が1日ズレるバグを避ける)
  function todayStr() {
    return formatLocal(new Date());
  }

  function addDays(dateStr, days) {
    const [y, m, day] = dateStr.split('-').map(Number);
    const d = new Date(y, m - 1, day);
    d.setDate(d.getDate() + days);
    return formatLocal(d);
  }

  function createProgress() {
    return {
      repetition: 0,
      interval: 0,
      ef: 2.5,
      dueDate: todayStr(),
      lastReviewed: null,
      reviewCount: 0,
      correctCount: 0
    };
  }

  // quality: 5=覚えていた(自信あり), 4=覚えていた, 2=忘れた
  function review(progress, remembered) {
    const p = progress || createProgress();
    const quality = remembered ? 4 : 2;

    let { repetition, interval, ef } = p;

    if (quality < 3) {
      repetition = 0;
      interval = 1;
    } else {
      if (repetition === 0) {
        interval = 1;
      } else if (repetition === 1) {
        interval = 6;
      } else {
        interval = Math.round(interval * ef);
      }
      repetition += 1;
    }

    ef = ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    if (ef < 1.3) ef = 1.3;

    return {
      repetition,
      interval,
      ef,
      dueDate: addDays(todayStr(), interval),
      lastReviewed: todayStr(),
      reviewCount: (p.reviewCount || 0) + 1,
      correctCount: (p.correctCount || 0) + (remembered ? 1 : 0)
    };
  }

  function isDue(progress) {
    if (!progress) return true;
    return progress.dueDate <= todayStr();
  }

  return { createProgress, review, isDue, todayStr, addDays };
})();
