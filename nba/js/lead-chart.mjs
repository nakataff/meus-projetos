const WIDTH = 720;
const HEIGHT = 164;
const MID = HEIGHT / 2;
const periodLength = period => period <= 4 ? 720 : 300;
const periodStart = period => period <= 4 ? (period - 1) * 720 : 2880 + (period - 5) * 300;

export function leadTimeline(plays) {
 const entries = [];
 for (const play of plays) {
  if (!Number.isInteger(play.period) || play.period < 1 || play.period > 20 ||
      ![play.scoreAway, play.scoreHome].every(score => Number.isInteger(score) && score >= 0)) continue;
  const clock = /^(?:(\d+):)?(\d{1,2}(?:[.,]\d+)?)$/.exec(play.clock);
  if (!clock) continue;
  const remaining = Number(clock[1] || 0) * 60 + Number(clock[2].replace(',', '.'));
  if (remaining > periodLength(play.period)) continue;
  entries.push({
   time: periodStart(play.period) + periodLength(play.period) - remaining,
   period: play.period, clock: play.clock, away: play.scoreAway, home: play.scoreHome
  });
 }
 if (!entries.length) return [];
 entries.sort((a,b) => a.time - b.time);
 const first = entries[0];
 // Só traçar o início do jogo quando a fonte informa que ele começou em 0 a 0.
 if (first.period === 1 && first.away === 0 && first.home === 0 && first.time > 0) {
  entries.unshift({time:0, period:1, clock:'12:00', away:0, home:0});
 }
 const result = [];
 for (const point of entries) {
  const previous = result.at(-1);
  if (!previous || point.time !== previous.time || point.away !== previous.away ||
      point.home !== previous.home || point.period !== previous.period) result.push(point);
 }
 return result;
}

function pointLabel(point, game) {
 const diff = point.home - point.away;
 const period = point.period <= 4 ? point.period + 'º quarto' : (point.period - 4) + 'ª prorrogação';
 return period + ' · ' + point.clock + ' · ' + game.away + ' ' + point.away + ' × ' + point.home + ' ' + game.home +
  ' · ' + (diff === 0 ? 'Empate' : (diff > 0 ? game.home : game.away) + ' +' + Math.abs(diff));
}

export function renderLeadChart(points, game, status, esc) {
 const heading = '<section class="section dlq-lead card"><div class="section-title"><h2>Evolução da vantagem</h2></div>';
 if (!points.length) {
  return heading + '<p class="subtle small">' +
   (status === 'scheduled' ? 'O gráfico aparece quando os primeiros lances forem publicados.' :
    'O gráfico aguarda os lances com placar desta partida.') + '</p></section>';
 }
 const last = points.at(-1);
 const periods = Math.max(4, last.period);
 const duration = periodStart(periods) + periodLength(periods);
 const maxLead = Math.max(1, ...points.map(p => Math.abs(p.home - p.away)));
 const x = time => (time / duration * WIDTH).toFixed(2);
 const y = point => (MID - (point.home - point.away) / maxLead * (MID - 12)).toFixed(2);
 const line = points.map((p,i) => (i ? 'H' + x(p.time) + 'V' : 'M' + x(p.time) + ' ') + y(p)).join('');
 const area = line + 'V' + MID + 'H' + x(points[0].time) + 'Z';
 const columns = Array.from({length:periods},(_,i) => {
  const start = periodStart(i + 1);
  return {
   divider: i ? '<path d="M' + x(start) + ' 0V' + HEIGHT + '"/>' : '',
   label: '<span style="flex:' + periodLength(i + 1) + '">' + (i < 4 ? (i + 1) + 'ºQ' : 'PR ' + (i - 3)) + '</span>'
  };
 });
 const scale = 'Maior vantagem · ' + maxLead + ' ' + (maxLead === 1 ? 'ponto' : 'pontos');
 return heading + '<div class="dlq-lead-legend"><span class="dlq-lead-home">' + esc(game.home) + ' ↑</span>' +
  '<small class="subtle">' + (points.every(p => p.home === p.away) ? 'Empate' : scale) + '</small>' +
  '<span class="dlq-lead-away">' + esc(game.away) + ' ↓</span></div>' +
  '<svg class="dlq-lead-plot" viewBox="0 0 ' + WIDTH + ' ' + HEIGHT + '" preserveAspectRatio="none" aria-hidden="true">' +
  '<defs><clipPath id="dlq-lead-top"><rect width="' + WIDTH + '" height="' + MID + '"/></clipPath>' +
  '<clipPath id="dlq-lead-bottom"><rect y="' + MID + '" width="' + WIDTH + '" height="' + MID + '"/></clipPath></defs>' +
  '<g class="dlq-lead-grid">' + columns.map(c => c.divider).join('') + '<path d="M0 ' + MID + 'H' + WIDTH + '"/></g>' +
  ['home','away'].map((side,i) => '<g class="dlq-lead-' + side + '" clip-path="url(#dlq-lead-' + (i ? 'bottom' : 'top') + ')">' +
   '<path class="dlq-lead-fill" d="' + area + '"/><path class="dlq-lead-line" d="' + line + '"/></g>').join('') +
  '<line class="dlq-lead-marker" x1="' + x(last.time) + '" x2="' + x(last.time) + '" y2="' + HEIGHT + '"/></svg>' +
  '<div class="dlq-lead-periods">' + columns.map(c => c.label).join('') + '</div>' +
  '<input class="dlq-lead-slider" type="range" min="0" max="' + (points.length - 1) + '" value="' + (points.length - 1) +
  '" aria-label="Explorar o placar lance a lance" aria-valuetext="' + esc(pointLabel(last,game)) + '">' +
  '<output class="dlq-lead-detail">' + esc(pointLabel(last,game)) + '</output></section>';
}

export function selectLeadPoint(slider, points, game) {
 const point = points[Number(slider.value)];
 if (!point) return;
 const duration = periodStart(Math.max(4, points.at(-1).period) + 1);
 const x = point.time / duration * WIDTH;
 const chart = slider.closest('.dlq-lead');
 const marker = chart.querySelector('.dlq-lead-marker');
 marker.setAttribute('x1', x);
 marker.setAttribute('x2', x);
 const label = pointLabel(point,game);
 slider.setAttribute('aria-valuetext', label);
 chart.querySelector('output').value = label;
}
