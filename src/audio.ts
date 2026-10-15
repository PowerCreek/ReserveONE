let ctx:AudioContext|null=null;
/** Call from a user gesture (the 🔔 toggle) so browsers allow playback. */
export function unlock(){try{const C=window.AudioContext||(window as any).webkitAudioContext;ctx=ctx??new C();void ctx.resume()}catch{}}
/** Dual-sine chime: 440Hz + 554.37Hz (spec §7). */
export function chime(){try{if(!ctx)return;const t=ctx.currentTime;
  for(const f of [440,554.37]){const o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.frequency.value=f;
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.15,t+.03);g.gain.exponentialRampToValueAtTime(.0001,t+.9);
    o.connect(g);g.connect(ctx.destination);o.start(t);o.stop(t+1)}}catch{}}
