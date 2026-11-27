// Timbres de síntese aditiva. Cada parcial define frequência relativa,
// amplitude e, nos sons percussivos, o tempo de decaimento em segundos.
const timbresPonto = (() => {
  const specs = {
    'Cavaquinho dedilhado': { gm: 24, attack: .005, partials: [[1,.68,.62],[2,.44,.31],[3,.27,.19],[4.01,.19,.12],[6,.10,.07]] },
    'Bandolim dobrado': { gm: 25, attack: .009, partials: [[1,.58,.94],[1.006,.40,.88],[2,.25,.38],[2.013,.19,.42],[4,.14,.15]] },
    'Kalimba': { gm: 108, attack: .004, partials: [[1,1,.62],[2.72,.21,.13],[5.14,.15,.08]] },
    'Marimba': { gm: 12, attack: .006, partials: [[1,1,.34],[4,.38,.095],[9.18,.14,.045]] },
    'Vibrafone': { gm: 11, attack: .009, tremolo: 4.8, partials: [[1,1,1.1],[4,.23,.38],[9.2,.08,.16]] },
    'Sino de vidro': { gm: 10, attack: .003, partials: [[1,.75,.96],[2.40,.44,.54],[3.86,.25,.32],[5.45,.12,.18]] },
    'Pluck elástico': { gm: 81, attack: .006, bend: .016, partials: [[1,.90,.25],[2,.42,.12],[3,.32,.07],[6,.16,.045]] },
    'Assovio suave': { gm: 78, attack: .05, sustain: true, vibrato: .09, partials: [[1,1],[2,.055],[3,.035]] },
    'Órgão de baile': { gm: 16, attack: .016, sustain: true, partials: [[1,.75],[2,.6],[3,.22],[4,.19],[6,.08]] },
    'Sanfona curta': { gm: 21, attack: .029, sustain: true, partials: [[1,.6],[1.005,.26],[2,.37],[3,.26],[4,.15],[5,.11]] },
    'Lead nasal': { gm: 84, attack: .012, sustain: true, partials: [[1,.61],[2,.08],[3,.47],[5,.3],[7,.2],[9,.09]] },
    'Flauta de bambu': { gm: 75, attack: .034, sustain: true, vibrato: .055, partials: [[1,.90],[2,.26],[3,.12],[5,.04]] }
  };
  const cache = new Map();
  const sr = 24000, tau = Math.PI * 2;

  function sample(spec, key) {
    const hz = 440 * 2 ** ((key - 69) / 12);
    const duration = spec.sustain ? 1.4 : Math.max(...spec.partials.map(p => p[2])) * 5;
    const y = new Float32Array(Math.ceil(duration * sr));
    for (const [ratio, gain, decay] of spec.partials) {
      const frequency = hz * ratio;
      if (frequency >= sr * .45) continue;
      let amplitude = gain, phase = 0;
      const step = tau * frequency / sr;
      const fade = decay ? Math.exp(-1 / (decay * sr)) : 1;
      for (let i = 0; i < y.length; i++) {
        const t = i / sr;
        phase += step * (1 + (spec.bend ? spec.bend * Math.exp(-t * 32) : 0));
        const vibrato = spec.vibrato ? spec.vibrato * ratio * Math.sin(tau * 5 * t) : 0;
        y[i] += amplitude * Math.sin(phase + vibrato);
        amplitude *= fade;
      }
    }
    let peak = .001;
    for (let i = 0; i < y.length; i++) {
      y[i] *= Math.min(1, i / (sr * spec.attack));
      if (spec.tremolo) y[i] *= .87 + .13 * Math.cos(tau * spec.tremolo * i / sr);
      peak = Math.max(peak, Math.abs(y[i]));
    }
    for (let i = 0; i < y.length; i++) y[i] *= .78 / peak;
    return { k: key, sr, y, loop: !!spec.sustain };
  }

  return {
    names: Object.keys(specs),
    program: name => specs[name].gm,
    has: name => Object.hasOwn(specs, name),
    sounds(name) {
      if (!cache.has(name)) cache.set(name, [55, 67, 79].map(k => sample(specs[name], k)));
      return cache.get(name);
    }
  };
})();
