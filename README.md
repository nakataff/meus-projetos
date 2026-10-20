# Meus Projetos

Central pessoal de aplicativos e ferramentas web da conta **nakataff**.

## Projetos

| Projeto | Caminho | Estado |
| --- | --- | --- |
| Quadra — NBA Tracker 2026/27 | [nba/](./nba/) | Disponível no repositório |
| Futebol Tracker | futuramente `futebol/` | Ideia futura |

A página inicial está em [index.html](./index.html). Cada aplicativo terá sua própria pasta e poderá evoluir separadamente.

## Publicar no GitHub Pages

1. Acesse **Settings → Pages** deste repositório.
2. Em **Build and deployment**, escolha **Deploy from a branch**.
3. Selecione **main** e **/(root)**.
4. Clique em **Save**.

Depois de publicar, os endereços esperados são:

- Central: https://nakataff.github.io/meus-projetos/
- NBA Tracker: https://nakataff.github.io/meus-projetos/nba/

## NBA Tracker: armazenamento

O NBA Tracker publicado nesta primeira versão utiliza **localStorage** no navegador. As avaliações e marcações ainda **não sincronizam entre dispositivos**. A integração com o Firebase será uma atualização futura. Até lá, use o recurso de backup JSON para proteger seus registros.

## Próximos passos

- Logos leves dos 30 times da NBA em WebP (`nba/assets/teams/`).
- Configurar autenticação e armazenamento individual com Firebase.
- Extrair o calendário do NBA para arquivos JSON menores, preservando um carregamento rápido.
- Adicionar novos aplicativos sem interferir nos projetos existentes.

> Não publique chaves privadas de serviço, tokens nem credenciais administrativas no repositório público.
