// Web Speech API (speechSynthesis) ラッパー。iOS Safariの癖に対応:
// - voiceschanged が遅れて発火するため、voice一覧はイベントで取り直す
// - speak() は必ずユーザー操作(タップ)のハンドラ内から呼ぶ
// - 初回タップで無音発話を1回行い、以降の発話をアンロックしておく
const TTS = (() => {
  let voices = [];
  let unlocked = false;
  const supported = 'speechSynthesis' in window;

  function loadVoices() {
    if (!supported) return;
    voices = window.speechSynthesis.getVoices();
  }

  if (supported) {
    loadVoices();
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
  }

  function pickEnglishVoice() {
    if (!voices.length) loadVoices();
    return (
      voices.find(v => v.lang === 'en-US') ||
      voices.find(v => v.lang && v.lang.startsWith('en')) ||
      voices[0] ||
      null
    );
  }

  function unlock() {
    if (!supported || unlocked) return;
    try {
      const u = new SpeechSynthesisUtterance('');
      u.volume = 0;
      window.speechSynthesis.speak(u);
      unlocked = true;
    } catch (e) {
      // no-op
    }
  }

  function speak(text, { rate = 0.9 } = {}) {
    if (!supported || !text) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    const voice = pickEnglishVoice();
    if (voice) {
      utter.voice = voice;
      utter.lang = voice.lang;
    } else {
      utter.lang = 'en-US';
    }
    utter.rate = rate;
    window.speechSynthesis.speak(utter);
  }

  return { supported, speak, unlock };
})();
