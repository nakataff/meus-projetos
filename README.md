# Meus Projetos

Central pessoal de aplicativos e ferramentas web da conta **nakataff**.

## Aplicativos

- **[Quadra — NBA Tracker](./nba/)** — calendário de transmissões, agenda completa, elencos, quintetos, notas, partidas assistidas e box scores.
- **Futebol Tracker** — planejado para o futuro.

**Links quando o GitHub Pages estiver publicado:** [Central](https://nakataff.github.io/meus-projetos/) · [NBA Tracker](https://nakataff.github.io/meus-projetos/nba/)

## QUADRA 3 — páginas independentes

O QUADRA foi dividido em rotas reais (arquivos HTML próprios), mantendo **exatamente a mesma origem, localStorage e coleção Firestore** para preservar o histórico:

| Página | Endereço |
| --- | --- |
| Início | [nba/](./nba/) |
| Agenda e transmissões | [nba/jogos/](./nba/jogos/) |
| Conferências e 30 equipes | [nba/equipes/](./nba/equipes/) |
| Página da franquia | [nba/equipe/?id=BOS](./nba/equipe/?id=BOS) |
| Perfil de atleta | `nba/jogador/?id=ID&team=BOS` |
| Centro da partida | `nba/jogo/?id=ID&data=2026-10-20` |
| Perfil | [nba/perfil/](./nba/perfil/) |

O menu principal agora usa **Perfil** no lugar de “Meu QUADRA”. A página inicial prioriza jogos de hoje, próximos confrontos do time favorito, transmissões brasileiras e partidas marcadas para a semana. As métricas pessoais foram transferidas para o Perfil, com abas **Resumo, Atividade, Rankings e Conquistas**. As conquistas são calculadas dos registros já salvos, sem novos serviços ou consultas ao Firestore. A rota antiga [`nba/meu-quadra/`](./nba/meu-quadra/) continua funcionando para links existentes.

O app utiliza **`nba/css/site.css` e `nba/js/app.js`** como recursos compartilhados. Cada página tem um controlador próprio em `nba/js/pages/`; a página atual carrega somente o controlador necessário. Dados esportivos chegam dos JSON mensais/equipe, e os box scores são carregados apenas ao acessar páginas que precisam deles.

**Compatibilidade:** os registros antigos em `quadra_nba_2026_27_v1`, `quadra_nba_settings_v1` e `quadra_nba_extra_2026_27_v1` continuam válidos. A integração Google/Firebase utiliza a mesma `QuadraBridge` e os mesmos documentos de usuário. A versão anterior foi preservada em [nba/legacy.html](./nba/legacy.html).

### Centro da Partida: titulares e estatísticas sem API paga

- **Antes da partida:** o provável quinteto é estimado com base na frequência de titularidade nas cinco partidas anteriores com dados suficientes, limitado ao elenco atual quando disponível. É uma **projeção**, não um anúncio oficial.
- **Durante a partida:** o navegador tenta buscar o box score individual da fonte pública ESPN diretamente para este jogo, com titulares marcados somente quando confirmados no retorno. A consulta automática ocorre aproximadamente a cada 2 minutos enquanto a página estiver visível, e há um botão **Atualizar estatísticas**. Os dados podem atrasar ou falhar.
- **Após a partida:** exibe o box score final diretamente, ou o arquivo JSON já importado pelo GitHub Actions como reserva. Após a transição de ao vivo para final, tenta obter a versão consolidada e interrompe consultas quando ela está completa.
- **Desempenho:** a página consulta somente os últimos meses necessários para a projeção e o box score do jogo aberto, sem baixar estatísticas de todos os confrontos. Os dados esportivos não são gravados no Firebase.
- **Fonte:** interface pública não oficial da ESPN, gratuita, sem chave e **sem SLA ou garantia de licença de redistribuição**. Em falhas de conexão ou indisponibilidade da fonte, a interface informa o problema e preserva o histórico.

### Box score comparativo, elencos e compartilhamento

- **Estatísticas → Ambos:** no computador exibe duas tabelas lado a lado. No celular, mistura atletas das duas equipes em **um único ranking**, ordenado pela estatística selecionada. Os times têm identificação visual por logo; nenhum ranking proprietário da SofaScore é copiado.
- **Escalações:** fotos, posições, titulares (confirmados ou projetados) e reservas abaixo. Os dados de uma projeção são identificados como provenientes de jogos anteriores.
- **Ficha individual:** clique na linha de um atleta no box score para abrir um card com seu desempenho, nota pessoal e voto MVP, com botão para **gerar PNG 1200×630** e compartilhar link.
- **Perfil do atleta:** estatísticas por jogo, médias dos box scores importados, filtros por mês e partida, visualização de desempenho específico via link `nba/jogador/?id=ID&team=CODIGO&game=ID_JOGO&data=AAAA-MM-DD`.
- A imagem é montada localmente com Canvas, sem guardar imagem no Firebase; fotos externas são opcionais e dependem de liberação CORS pela fonte. Os números vêm dos box scores disponíveis, e podem ser parciais durante jogos em andamento.

Na nova página de partida, o quinteto antes do jogo é indicado **como projeção baseada em titularidades anteriores**, nunca como escalação oficial. Titulares oficiais são marcados somente quando já existem no box score. O calendário abre no dia atual, permite voltar e avançar um dia, escolher uma data no calendário ou alternar para Próximos jogos e Temporada inteira. Resultados e estatísticas aparecem normalmente, sem ocultação de placares.

**Antes de começar a usar a nova versão intensivamente, faça um backup JSON** na página Meu QUADRA, teste uma avaliação no computador e verifique se ela surge no celular com a mesma conta Google.

## QUADRA: como funciona

A agenda inicial contém os jogos brasileiros da ESPN/Disney+ e do Prime Video. Os demais confrontos, elencos e estatísticas finais vêm de arquivos JSON atualizados pelo GitHub Actions.

Na página da NBA você pode:

- filtrar por equipe, mês, transmissão, status e fase; consultar jogos de toda a temporada;
- marcar **assistido**, **quero assistir**, dar nota de 0 a 10 e escrever comentários;
- navegar pelas conferências **Leste/Oeste**, suas divisões e as 30 franquias;
- avaliar individualmente jogadores, selecionar **franchise player**, favoritos e seu quinteto pessoal;
- ver o **último quinteto titular confirmado** onde houver box score importado (não é uma previsão dos titulares do próximo jogo);
- consultar box score após o resultado final e votar em seu MVP da partida;
- navegar por dias com setas e calendário; começar pelos jogos de hoje sem precisar percorrer a pré-temporada;
- exportar/importar um **backup completo** de notas, preferências e jogadores.

### Como são atualizados os dados — custo zero

A rotina [`.github/workflows/nba-sync.yml`](./.github/workflows/nba-sync.yml) executa [`scripts/sync_nba.py`](./scripts/sync_nba.py) automaticamente a cada meia hora para jogos recentes, com duas sincronizações completas por dia, e também ao atualizar o script.

Se quiser atualizar manualmente:
1. Entre na aba [**Actions**](https://github.com/nakataff/meus-projetos/actions/workflows/nba-sync.yml).
2. Selecione **Atualizar dados NBA → Run workflow → Run workflow**.
3. Espere o status verde. O script salva mudanças automaticamente na branch `main`.

Arquivos gerados:
```text
nba/
├── index.html
├── css/upgrade.css
├── js/upgrade.js
├── assets/
│   ├── nba.png
│   └── teams/  (30 logos WebP)
└── data/
    ├── months/2026-10.json ... 2027-04.json
    ├── teams/BOS.json ... WAS.json
    └── stats/2026-10.json ... 2027-04.json (conforme houver resultados finais)
```

**Fonte de dados:** endpoints públicos não oficiais da ESPN, sem chave de API e sem garantia de estabilidade, cobertura, disponibilidade ou licença para redistribuição irrestrita. Este projeto pessoal não é oficial nem afiliado à NBA ou ESPN; antes de ampliar a publicação, confira os termos aplicáveis. A agenda original das transmissões brasileiras foi publicada pelo Hoops Brasil. Quando a fonte externa falha, o QUADRA mantém os jogos básicos cadastrados e os últimos dados em cache. Partidas a definir (como alguns jogos da NBA Cup) só aparecem corretamente depois da confirmação.

A rotina **não é placar ao vivo**. Box scores são dados importados após o término e sincronizados em lotes; pode haver atraso. A automação usa runners padrão do GitHub Actions em um repositório público, normalmente sem cobrança.

### Dados pessoais e Firebase (futuro)

**Firebase pronto para configurar.** A interface já oferece login Google e sincronização opcional com Cloud Firestore, mas **só funciona depois que o proprietário criar o projeto no Firebase e configurar as regras**. Enquanto isso, as avaliações continuam no `localStorage`. Leia o [passo a passo de instalação](./nba/firebase/SETUP.md). O backup JSON continua disponível e deve ser feito antes da primeira migração.

Não comite tokens, credenciais privadas ou chaves administrativas no repositório público.

## Organização

Cada aplicativo fica em uma pasta independente para evitar downloads e dependências desnecessários em outros projetos.


### Nota QUADRA e classificação da NBA 2026/27

- **Nota QUADRA**: nota automática de 1,0 a 10,0 com algoritmo próprio, a partir de pontos, rebotes, assistências, roubos, tocos, desperdícios, arremessos errados e saldo em quadra. Não equivale à nota oficial NBA/SofaScore. É mostrada no box score e no destaque do melhor desempenho de cada partida. A nota pessoal do usuário permanece independente.
- **Sem placar manual**: o diário da partida continua permitindo marcar jogos assistidos, avaliar e comentar. Os placares antigos foram preservados nos backups, mas não aparecem nos cards nem sobrescrevem os importados.
- **Classificação**: a rota nba/classificacao/ apresenta a tabela geral, conferências e divisões. O script scripts/sync_nba.py gera o arquivo compacto nba/data/standings/2026-27.json a partir dos jogos finalizados da temporada regular, excluindo pré-temporada e playoffs. A ordenação de empates usa aproveitamento e saldo; não reproduz todos os critérios oficiais da NBA.


### Estatísticas nos perfis das 30 franquias

- Cada equipe em nba/equipe/?id=CODIGO possui **Resumo** (campanha, aproveitamento, pontos feitos e sofridos por jogo, médias coletivas de rebotes/assistências, FG%, 3PT% e saldo), líderes individuais em pontos/rebotes/assistências e último quinteto disponível.
- A aba **Estatísticas** tem ranking individual por médias, jogos, titularidades, minutos e percentuais de arremessos, com ordenação por coluna e links para os perfis dos atletas.
- Um filtro explícito separa **Temporada regular** de **Pré-temporada**. Nunca somar fases diferentes na mesma média. Os dados coletivos derivados de box scores só usam jogos para os quais há estatísticas individuais disponíveis, sempre exibindo o número da amostra.
- A rotina scripts/sync_nba.py gera arquivos por equipe em nba/data/team-stats/CODIGO.json com valores acumulados e quinteto recente, atualizados pelo GitHub Actions. Isso evita baixar os arquivos mensais de box score (grandes) ao abrir uma franquia.
- Os cards da página Equipes também mostram a campanha atual (V/D). Se ainda não há partidas regulares da franquia, a interface avisa e permite consultar os números de pré-temporada.

### Ranking de jogadores: atualização automática após as partidas

- `nba/js/live.js`: na página Jogadores consulta hoje e ontem durante todo o dia, inclusive após as 8h de Brasília. Isso recupera os finais da noite anterior mesmo quando o GitHub Actions ainda não consolidou a rodada. Mantém o ritmo compartilhado de 15 segundos com jogo ao vivo e 2 minutos sem jogo ao vivo; pausa em abas ocultas.
- `nba/js/pages/leaders.js`: revalida o ranking compacto a cada minuto na aba visível; consulta box scores apenas dos finais ausentes, com até três pedidos simultâneos e sem contar jogos duplicados. Exige status final no resumo e pelo menos cinco participantes de cada equipe. Recupera falhas em novas tentativas e preserva os filtros. Os menus de rodadas também atualizam quando chega um novo jogo. Correções estatísticas são detectadas mesmo sem mudar o número de partidas.
- A data “Dados até” vem das partidas efetivamente incluídas na fase selecionada. Não usa uma data final do calendário que ainda esteja sem box score.
- `.github/workflows/nba-sync.yml`: consolidação recente a cada meia hora durante o dia inteiro; calendário completo/elencos às 08h e 17h BRT. Cron do GitHub está sujeito a atrasos, por isso a página não depende dele para complementar finais de ontem/hoje.
- `scripts/sync_nba.py`: tenta novamente box scores incompletos dentro da janela de 21 dias; resumos incompletos não entram nos totais nem na lista de jogos contabilizados. Dados esportivos continuam em JSON/ESPN, sem consultas ou gravações no Firebase/Cloudflare.
- Verificações: `python -m unittest discover -s scripts/tests` e `NODE_PATH=/caminho/para/jsdom/node_modules node --test nba/test/ranking-auto.test.cjs`.

#### Inclusão assim que o jogo acaba

O evento compartilhado `quadra:live-update` dispara imediatamente a tentativa de incluir um novo FINAL, sem esperar o minuto do ranking ou o cron do GitHub. Enquanto há jogos ao vivo o placar é consultado a cada 15 segundos; não é um WebSocket. Se o resumo da ESPN ainda estiver parcial, o ranking faz até seis tentativas com pausas de 10 segundos depois das respostas; depois retoma a verificação normal. Cada jogo aprovado aparece assim que sua resposta chega, sem esperar outras partidas. Tentativas são por ID, com até três pedidos simultâneos, pausam em abas ocultas/offline e param para jogos já contabilizados. A disponibilidade final continua dependendo da fonte.

No perfil do jogador, o Histórico por partida tem filtro próprio de fase (temporada regular como padrão, pré-temporada ou todas). Os seletores de mês e jogo acompanham essa fase; não altera a seleção independente das médias. Links para uma partida específica abrem o histórico na fase correspondente. Filtra os JSONs já carregados, sem consultas adicionais.

### Quadra 2D, comparador e opções dos jogadores

- A quadra mostra os pontos das duas equipes usando o mesmo status/summary já consultado; a atualização externa do placar chama `courtController.syncScore()`, sem criar outra rotina de rede. Ao rever um lance, mostra o placar daquele registro (quando informado); “Ir ao mais recente” volta ao placar atual.
- Tela cheia usa a Fullscreen API quando disponível e um modo expandido com CSS em navegadores sem suporte. Botão de sair e Escape funcionam; sair da aba da quadra limpa o modo expandido e os listeners. O modo não força orientação nem altera a frequência das consultas.
- `nba/js/player-actions.js`: menu ao segurar por 550ms, botão ⋯ ou clique direito nas linhas/cards; menu com teclado (Shift+F10, setas, Escape). Movimento de rolagem cancela o gesto. Oferece perfil, card, comparação e, no ranking, seguir/deixar de seguir.
- Comparação na partida usa apenas os números do confronto aberto. Na página Jogadores usa fase/rodadas e soma/média selecionadas. Nota DLQ e percentuais mantêm suas definições. O comparador captura os dados ao abrir para que o card revisado não mude durante uma atualização ao vivo.
- `nba/js/comparison-card.js`: Canvas com layouts próprios de 1200×630, 1080×1080, 1080×1350 e 1080×1920. Fotos com ajuste inteiro, nomes em até duas linhas com fonte adaptável, oito métricas, marca e link. No story a informação fica entre 10% e 80% da altura, reservando as áreas de interface. Outros formatos mantêm margens de pelo menos 50px. Imagens externas têm limite de espera e falha preserva os números.
- `nba/js/share-card.js`: o gerador existente reutiliza prévia, cópia de imagem, compartilhamento e PNG. O renderer da comparação só carrega ao gerar um card comparativo. `nba/css/player-tools.css` é compartilhado somente entre Partida e Jogadores. Os números vêm dos dados já carregados; não grava no Firebase nem usa Cloudflare.

#### Escolha por equipe e personalização do comparador

O comparador agora usa botões de jogador com foto e agrupamento por equipe, busca local sem acentos por nome/equipe e até 60 opções visíveis por página. Seleção inicial na partida prioriza um atleta de cada time; é possível comparar colegas do mesmo time. Não permite selecionar o mesmo atleta dos dois lados.

Em Jogadores, fase, rodada e média/total são independentes dos filtros da página principal. O JSON compacto `player-rounds/2026-27.json` é carregado apenas ao selecionar um recorte por rodada e reutiliza o cache da página. Um atleta sem jogo no recorte permanece selecionado com valores indisponíveis (não zero nem números de outro jogo). Erros de leitura bloqueiam a exportação e oferecem nova tentativa.

`nba/js/comparison-fields.js` centraliza 11 estatísticas e a formatação; tela, prévia e PNG usam as mesmas chaves. É possível escolher uma ou mais estatísticas, presets Essenciais/Todas e visual em lista ou blocos. O gerador de card permite ajustar novamente o visual, as estatísticas e o formato antes de copiar/compartilhar/salvar. O renderer distribui de 1 a 11 métricas no espaço seguro de cada formato, inclusive o story com áreas reservadas. Não há novas gravações nem consultas de usuários.

No seletor do comparador, os atletas são ordenados por pontos decrescentes dentro de cada equipe, com pontos (ou média PTS/J) visíveis na opção. Valores indisponíveis ficam ao fim e empates usam o nome. O botão Recarregar dados aparece apenas após falha ao obter as rodadas; a regra CSS de `hidden` prevalece sobre o display de botões compartilhados.

### Busca e navegação NBA

A lupa compartilhada abre a busca por equipes, jogadores, partidas e atalhos. `nba/data/search.json` é um índice compacto gerado dos JSON existentes por `scripts/build_nba_search.py`, também chamado ao final da sincronização NBA. O índice só é solicitado na primeira abertura da busca; as letras são filtradas localmente com debounce, sem consultas ao banco. O menu superior tem quatro atalhos e a barra inferior recolhível salva apenas a preferência local.
