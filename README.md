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

A rotina [`.github/workflows/nba-sync.yml`](./.github/workflows/nba-sync.yml) executa [`scripts/sync_nba.py`](./scripts/sync_nba.py) automaticamente quatro vezes ao dia e também ao atualizar o script.

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
