/* Movimentações da temporada: cartões leves, sem chamadas externas por visitante. */
import {esc,logo,name,playerLink} from './app.js?v=14';

const clean = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const rosterMatch = (list, record) => {
  if (record.id) {
    const byId = list.find(p => String(p.id) === String(record.id));
    if (byId) return byId;
  }
  return list.find(p => clean(p.name) === clean(record.name)) || null;
};
const teamText = code => code ? name(code) : 'Origem não informada';
const rosterPhoto = (player, code) => {
  const src = player?.headshot || logo(code);
  return '<img class="dlq-move-photo" src="' + esc(src) + '" loading="lazy" decoding="async" alt="" onerror="this.onerror=null;this.src=\'' + esc(logo(code)) + '\'">';
};
function moveCard(item, roster, code, direction) {
  const player = rosterMatch(roster, item);
  const href = player && direction === 'arrivals' ? playerLink(player.id, code) : '';
  const label = item.kind || (direction === 'departures' ? 'Saída' : 'Contratação');
  const counterpart = direction === 'departures' ? item.to : item.from;
  const heading = direction === 'departures' ? 'Destino' : (item.kind === 'Agente livre' || item.fromBasis ? 'Última equipe' : 'Veio de');
  const external = direction === 'departures' ? item.toLabel : item.fromLabel;
  const detail = counterpart
    ? '<span class="dlq-move-origin">' + esc(heading) + ': <img src="' + esc(logo(counterpart)) + '" width="20" height="20" loading="lazy" alt=""> <strong>' + esc(teamText(counterpart)) + '</strong></span>'
    : external
    ? '<span class="dlq-move-origin">' + esc(heading) + ': <strong>' + esc(external) + '</strong></span>'
    : '<span class="dlq-move-origin">' + (direction === 'arrivals' ? 'Equipe anterior não confirmada' : 'Destino não confirmado') + '</span>';
  const title = href ? '<a href="' + esc(href) + '">' + esc(item.name) + '</a>' : '<strong>' + esc(item.name) + '</strong>';
  return '<article class="dlq-move-card">' + rosterPhoto(player, code) +
   '<div class="dlq-move-body"><div class="dlq-move-top"><span class="dlq-move-kind">' + esc(label) + '</span>' +
   (item.date ? '<time datetime="' + esc(item.date) + '">' + esc(new Date(item.date + 'T12:00:00Z').toLocaleDateString('pt-BR', {timeZone:'UTC'})) + '</time>' : '') +
   '</div><div class="dlq-move-name">' + title + '</div>' + detail + '</div></article>';
}
function draftCard(item, roster, code) {
  const player = rosterMatch(roster, item);
  const href = player ? playerLink(player.id, code) : '';
  const title = href ? '<a href="' + esc(href) + '">' + esc(item.name) + '</a>' : '<strong>' + esc(item.name) + '</strong>';
  const original = item.selectedBy && item.selectedBy !== code
    ? '<span class="dlq-move-origin">Selecionado originalmente por ' + esc(teamText(item.selectedBy)) + '</span>' : '';
  return '<article class="dlq-move-card dlq-draft-card">' +
   '<span class="dlq-draft-pick">#' + esc(item.pick || '—') + '<small>' + (Number(item.round) === 2 ? '2ª RODADA' : '1ª RODADA') + '</small></span>' +
   '<div class="dlq-move-body"><div class="dlq-move-top"><span class="dlq-move-kind is-draft">Draft 2026</span></div>' +
   '<div class="dlq-move-name">' + title + '</div><span class="dlq-move-origin">' + esc(item.college || 'Origem não informada') + '</span>' + original + '</div></article>';
}
const sortMoves = list => [...list].sort((a,b) => (b.date || '').localeCompare(a.date || '') || String(a.name).localeCompare(String(b.name),'pt-BR'));
function movementGroup(title, key, rows, roster, code, empty) {
  return '<section class="dlq-move-group"><div class="section-title"><h3>' + title + ' <span class="dlq-move-count">' + rows.length + '</span></h3></div>' +
   (rows.length ? '<div class="dlq-move-list">' +
     (key === 'draft' ? rows.sort((a,b) => Number(a.pick)-Number(b.pick)).map(x => draftCard(x,roster,code))
       : sortMoves(rows).map(x => moveCard(x,roster,code,key))).join('') + '</div>'
    : '<p class="dlq-move-empty">' + empty + '</p>') + '</section>';
}
export function transactionsPreview(data, roster, code) {
  if (!data) return '';
  const recent = sortMoves(data.arrivals || []).slice(0,3);
  const drafted = (data.draft || []).slice().sort((a,b) => a.pick-b.pick).slice(0,1);
  if (!recent.length && !drafted.length) return '';
  return '<section class="section dlq-move-preview"><div class="section-title"><h2>Mercado da temporada</h2>' +
   '<button type="button" class="btn ghost" data-tab="movimentacoes">Todas as movimentações →</button></div>' +
   '<div class="dlq-move-preview-grid">' + recent.map(x => moveCard(x,roster,code,'arrivals')).join('') +
   (!recent.length ? drafted.map(x => draftCard(x,roster,code)).join('') : '') + '</div></section>';
}
export function transactionsPanel(data, roster, code, ready = false) {
  if (!ready) return '<section class="section"><div class="filler">Carregando movimentações...</div></section>';
  if (!data) return '<section class="section"><div class="filler">Não foi possível carregar as movimentações desta temporada.</div></section>';
  const arrivals = data.arrivals || [], departures = data.departures || [], draft = data.draft || [];
  return '<section class="section dlq-transactions"><div class="section-title"><div><h2>Movimentações 2026/27</h2>' +
   '<p class="small subtle">Entradas, saídas e escolhas do Draft 2026 da franquia.</p></div></div>' +
   '<div class="dlq-move-totals"><span><strong>' + arrivals.length + '</strong> chegadas</span><span><strong>' + departures.length +
   '</strong> saídas</span><span><strong>' + draft.length + '</strong> escolhas</span></div>' +
   '<nav class="dlq-move-filters" aria-label="Filtrar movimentações">' +
   [['all','Tudo'],['arrivals','Chegadas'],['departures','Saídas'],['draft','Draft']].map(([k,label]) =>
   '<button type="button" class="pill ' + (k==='all'?'active':'') + '" data-move-filter="' + k +
   '" aria-pressed="' + (k==='all') + '">' + label + '</button>').join('') + '</nav>' +
   '<div data-move-section="arrivals">' + movementGroup('Chegadas','arrivals',arrivals,roster,code,'Sem entradas confirmadas nos dados disponíveis.') + '</div>' +
   '<div data-move-section="departures">' + movementGroup('Saídas','departures',departures,roster,code,'Sem saídas confirmadas nos dados disponíveis.') + '</div>' +
   '<div data-move-section="draft">' + movementGroup('Draft de 2026','draft',draft,roster,code,'Sem escolhas do Draft associadas à equipe.') + '</div>' +
   '<p class="small subtle dlq-move-note">Fontes: <a href="https://www.nba.com/news/nba-offseason-deals-2026" target="_blank" rel="noopener noreferrer">NBA.com (movimentações)</a>, ' +
   '<a href="https://www.nba.com/news/2026-nba-draft-order" target="_blank" rel="noopener noreferrer">NBA.com (Draft)</a> e ESPN. ' +
   'As transferências podem mudar ao longo da temporada. Na ausência de confirmação, a equipe de origem não é presumida.</p></section>';
}
export function filterTransactions(root, selected) {
  const tabs = root.querySelectorAll('[data-move-filter]');
  tabs.forEach(button => {
    const on = button.dataset.moveFilter === selected;
    button.classList.toggle('active', on);
    button.setAttribute('aria-pressed',String(on));
  });
  root.querySelectorAll('[data-move-section]').forEach(section => {
    section.hidden = selected !== 'all' && section.dataset.moveSection !== selected;
  });
}
