// 発音判定ロジック。将来クラウドSTT/比較APIに差し替えやすいよう
// checkPronunciation() のみを外部から呼び出す単一の窓口にしている。
const Pronunciation = (() => {
  function normalize(s) {
    return (s || '')
      .toLowerCase()
      .trim()
      .replace(/[.,!?;:'"()]/g, '')
      .replace(/\s+/g, ' ');
  }

  function levenshtein(a, b) {
    const m = a.length, n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;
    let prev = new Array(n + 1);
    let curr = new Array(n + 1);
    for (let j = 0; j <= n; j++) prev[j] = j;

    for (let i = 1; i <= m; i++) {
      curr[0] = i;
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        curr[j] = Math.min(
          prev[j] + 1,      // deletion
          curr[j - 1] + 1,  // insertion
          prev[j - 1] + cost // substitution
        );
      }
      [prev, curr] = [curr, prev];
    }
    return prev[n];
  }

  function similarityScore(a, b) {
    const na = normalize(a);
    const nb = normalize(b);
    if (!na && !nb) return 1;
    const dist = levenshtein(na, nb);
    const maxLen = Math.max(na.length, nb.length) || 1;
    return Math.max(0, 1 - dist / maxLen);
  }

  // 差し替えポイント: 将来クラウドSTTの結果比較APIに置き換える場合はこの関数の中身だけを変更する
  async function checkPronunciation(spokenText, targetText, threshold = 0.75) {
    const score = similarityScore(spokenText, targetText);
    return {
      score,
      percent: Math.round(score * 100),
      pass: score >= threshold
    };
  }

  return { levenshtein, similarityScore, checkPronunciation };
})();
