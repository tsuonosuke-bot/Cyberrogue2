/* FIXER'S CUT — 編成の再利用・合成効果音。ui.js より先に読み込む（描画が Comfort を使う） */
const Comfort = (() => {
  const SOUND_KEY = 'fixers-cut-sound';
  const read = (key, fallback) => { try { return localStorage.getItem(key) || fallback; } catch (_) { return fallback; } };
  const write = (key, value) => { try { localStorage.setItem(key, value); } catch (_) { /* 設定の保存失敗でも続行 */ } };
  let sound = read(SOUND_KEY, 'off') === 'on';
  let audio = null, lastSound = -Infinity;

  function unlockAudio() {
    if (!sound) return;
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      if (!audio) audio = new Audio();
      if (audio.state === 'suspended') { const p = audio.resume(); if (p && p.catch) p.catch(() => {}); }
    } catch (_) { audio = null; }
  }
  function tone(line) {
    if (!sound || !audio || audio.state !== 'running' || instantLog()) return;
    const now = Date.now();
    if (now - lastSound < 100) return;
    let notes;
    const has = (k) => line.classList.contains(k);
    if (has('dead') || /死亡セーブ/.test(line.textContent || '')) notes = [180, 120, 80];
    else if (has('goal')) notes = [440, 660, 880];
    else if (has('ok')) notes = [520, 780];
    else if (has('ng')) notes = [240, 160];
    else if (has('warn')) notes = [300, 300];
    else return;
    lastSound = now;
    try {
      const start = audio.currentTime;
      const oscillator = audio.createOscillator(), gain = audio.createGain();
      oscillator.type = has('dead') ? 'triangle' : 'sine';
      notes.forEach((f, i) => oscillator.frequency.setValueAtTime(f, start + i * .045));
      gain.gain.setValueAtTime(.035, start);
      gain.gain.exponentialRampToValueAtTime(.001, start + notes.length * .045);
      oscillator.connect(gain); gain.connect(audio.destination);
      oscillator.start(start); oscillator.stop(start + notes.length * .045 + .01);
    } catch (_) { /* 音声非対応の環境でも通信は継続 */ }
  }
  function soundButton() {
    return `<button data-act="sound" aria-pressed="${sound}">効果音 ${sound ? 'オン' : 'オフ'}</button>`;
  }
  function restoreTeam(job) {
    if (!G.lastTeam) return '前回の編成はまだありません';
    const team = { field: [], support: [], net: [] }, skipped = [], used = new Set();
    for (const lane of Object.keys(team)) {
      for (const id of G.lastTeam[lane] || []) {
        const r = getR(id);
        if (!r || !available(r) || used.has(id) || team[lane].length >= LANE_MAX[lane] || (lane === 'net' && r.role !== 'net')) {
          skipped.push(r ? r.name : `離脱済み #${id}`); continue;
        }
        team[lane].push(id); used.add(id);
      }
    }
    UI.team[job.uid] = team;
    UI.est = { key: '', val: null };
    const errors = validateTeam(job, team);
    return [skipped.length ? `出せないため除外：${skipped.join('、')}` : '前回の編成を呼び出しました', ...errors].join('。');
  }
  document.addEventListener('click', unlockAudio, { capture: true });
  return {
    soundButton, restoreTeam, tone,
    toggleSound() { sound = !sound; write(SOUND_KEY, sound ? 'on' : 'off'); unlockAudio(); },
  };
})();
