/**
 * Screen recorder — getDisplayMedia + MediaRecorder.
 * Downloads WebM video and optional separate audio track.
 */

const preview = document.getElementById('preview');
const btnStart = document.getElementById('btnStart');
const btnStop = document.getElementById('btnStop');
const timerEl = document.getElementById('timer');
const statusEl = document.getElementById('status');
const micAudioEl = document.getElementById('micAudio');
const systemAudioEl = document.getElementById('systemAudio');
const audioModeEl = document.getElementById('audioMode');

let displayStream = null;
let micStream = null;
let mixedStream = null;
let mediaRecorder = null;
let audioRecorder = null;
let chunks = [];
let audioChunks = [];
let startedAt = 0;
let tickId = null;

function stamp(prefix, ext) {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${prefix}_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.${ext}`;
}

function setStatus(msg) {
  statusEl.textContent = msg;
}

function formatTime(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

async function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  try {
    await chrome.runtime.sendMessage({ type: 'DOWNLOAD', url, filename });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}

function pickMime(kinds) {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'audio/webm;codecs=opus',
    'audio/webm'
  ];
  for (const c of candidates) {
    if (!MediaRecorder.isTypeSupported(c)) continue;
    if (kinds === 'audio' && !c.startsWith('audio/')) continue;
    if (kinds === 'video' && !c.startsWith('video/')) continue;
    return c;
  }
  return '';
}

async function start() {
  const mode = audioModeEl.value;
  setStatus('Pick a screen, window, or tab…');

  displayStream = await navigator.mediaDevices.getDisplayMedia({
    video: { frameRate: 30 },
    audio: systemAudioEl.checked
  });

  const tracks = [...displayStream.getVideoTracks()];

  if (micAudioEl.checked && mode !== 'video') {
    try {
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true
        }
      });
    } catch {
      setStatus('Microphone denied — continuing without mic.');
    }
  }

  // Mix audio tracks if needed
  const audioTracks = [
    ...displayStream.getAudioTracks(),
    ...(micStream ? micStream.getAudioTracks() : [])
  ];

  let audioDestTrack = null;
  if (audioTracks.length) {
    const ctx = new AudioContext();
    const dest = ctx.createMediaStreamDestination();
    for (const t of audioTracks) {
      const src = ctx.createMediaStreamSource(new MediaStream([t]));
      src.connect(dest);
    }
    audioDestTrack = dest.stream.getAudioTracks()[0];
  }

  if (mode !== 'audio' && tracks[0]) {
    const videoTracks = audioDestTrack ? [...tracks, audioDestTrack] : tracks;
    mixedStream = new MediaStream(videoTracks);
    preview.srcObject = displayStream;

    const mime = pickMime('video');
    chunks = [];
    mediaRecorder = new MediaRecorder(mixedStream, mime ? { mimeType: mime, videoBitsPerSecond: 5_000_000 } : undefined);
    mediaRecorder.ondataavailable = (e) => {
      if (e.data?.size) chunks.push(e.data);
    };
    mediaRecorder.start(1000);
  }

  if ((mode === 'both' || mode === 'audio') && audioDestTrack) {
    const audioStream = new MediaStream([audioDestTrack.clone()]);
    const amime = pickMime('audio');
    audioChunks = [];
    audioRecorder = new MediaRecorder(audioStream, amime ? { mimeType: amime } : undefined);
    audioRecorder.ondataavailable = (e) => {
      if (e.data?.size) audioChunks.push(e.data);
    };
    audioRecorder.start(1000);
  } else if (mode === 'audio' && !audioDestTrack) {
    throw new Error('No audio track available. Enable mic or tab audio.');
  }

  if (mode === 'audio') {
    preview.srcObject = null;
  }

  displayStream.getVideoTracks()[0]?.addEventListener('ended', () => stop());

  startedAt = Date.now();
  tickId = setInterval(() => {
    timerEl.textContent = formatTime(Date.now() - startedAt);
  }, 250);

  btnStart.disabled = true;
  btnStop.disabled = false;
  setStatus('Recording…');
}

function stopRecorder(rec) {
  return new Promise((resolve) => {
    if (!rec || rec.state === 'inactive') return resolve(null);
    rec.onstop = () => resolve(true);
    rec.stop();
  });
}

async function stop() {
  clearInterval(tickId);
  tickId = null;
  btnStop.disabled = true;
  setStatus('Finalizing…');

  await Promise.all([stopRecorder(mediaRecorder), stopRecorder(audioRecorder)]);

  const mode = audioModeEl.value;
  const stampBase = stamp('flexshot_recording', 'webm').replace('.webm', '');

  if (chunks.length && mode !== 'audio') {
    const blob = new Blob(chunks, { type: chunks[0]?.type || 'video/webm' });
    await downloadBlob(blob, `${stampBase}.webm`);
  }
  if (audioChunks.length && (mode === 'both' || mode === 'audio')) {
    const blob = new Blob(audioChunks, { type: audioChunks[0]?.type || 'audio/webm' });
    await downloadBlob(blob, `${stampBase}_audio.webm`);
  }

  cleanup();
  timerEl.textContent = '00:00';
  btnStart.disabled = false;
  setStatus('Downloads started. Record again anytime.');
}

function cleanup() {
  [displayStream, micStream, mixedStream].forEach((s) => {
    s?.getTracks().forEach((t) => t.stop());
  });
  displayStream = micStream = mixedStream = null;
  mediaRecorder = audioRecorder = null;
  chunks = [];
  audioChunks = [];
  preview.srcObject = null;
}

btnStart.addEventListener('click', () => {
  start().catch((err) => {
    cleanup();
    btnStart.disabled = false;
    btnStop.disabled = true;
    setStatus(err.message || String(err));
  });
});

btnStop.addEventListener('click', () => {
  stop().catch((err) => setStatus(err.message || String(err)));
});
