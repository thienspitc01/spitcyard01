
let alarmInterval: number | null = null;
let audioCtx: AudioContext | null = null;

export const startAlarm = () => {
  if (alarmInterval) return;

  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }

  const playPulse = () => {
    if (!audioCtx) return;
    
    // Tạo 2 oscillator song song để âm thanh "gắt" hơn
    const osc1 = audioCtx.createOscillator();
    const osc2 = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc1.type = 'square';
    osc1.frequency.setValueAtTime(900, audioCtx.currentTime);
    osc1.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + 0.4);

    osc2.type = 'sawtooth'; // Sawtooth tạo độ nhiễu gắt như còi
    osc2.frequency.setValueAtTime(400, audioCtx.currentTime);
    osc2.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.4);

    gain.gain.setValueAtTime(0.7, audioCtx.currentTime); // Âm lượng lớn
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(audioCtx.destination);

    osc1.start();
    osc2.start();
    osc1.stop(audioCtx.currentTime + 0.4);
    osc2.stop(audioCtx.currentTime + 0.4);
  };

  playPulse();
  // Lặp lại nhanh hơn (600ms) để gây sốt ruột
  alarmInterval = window.setInterval(playPulse, 600);
};

export const stopAlarm = () => {
  if (alarmInterval) {
    window.clearInterval(alarmInterval);
    alarmInterval = null;
  }
};

export const playNotificationSound = () => {
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.setValueAtTime(1108.73, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.5);
};
