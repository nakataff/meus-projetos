# Web Push do De La Quadra

O GitHub Pages entrega a interface. O Worker consulta a ESPN uma vez por minuto e guarda as assinaturas do navegador e o histórico de envios em um Durable Object SQLite. O sino e os avisos dentro do site também funcionam sem o Worker, enquanto a página estiver aberta em primeiro plano.

## Ativar o envio

1. Ative o subdomínio workers.dev na conta Cloudflare. Cadastre o ID da conta e um token restrito à edição de Workers nos secrets do GitHub, como `CLOUDFLARE_ACCOUNT_ID` e `CLOUDFLARE_API_TOKEN`.
2. Na aba Actions do repositório, execute **Publicar notificações do De La Quadra** na branch main. O fluxo gera as chaves VAPID no primeiro deploy, preserva as chaves existentes e verifica a resposta do Worker.
3. Copie a URL HTTPS mostrada no resumo da execução para `nba/js/alerts-config.mjs`, atualize a versão da importação desse arquivo em `nba/js/alerts.js` e publique o site. O botão **Ativar avisos no celular** aparecerá no sino.
4. No iPhone ou iPad, abra pelo ícone da Tela de Início, toque no sino, ative os avisos e use **Enviar aviso de teste**. Acompanhe uma partida para confirmar que os eventos também chegam com o app fechado.

O cron usa os registros de jogo publicados pela ESPN. Cada jogo usa o mesmo identificador para alertas por time, jogador e transmissão, inclusive quando o usuário segue mais de uma dessas opções. O serviço só envia avisos recentes, em lotes de até 24 por minuto, e elimina assinaturas que o provedor informa como expiradas. A agenda do site agrupa ESPN e Disney+ e inclui o Prime Video quando informado.
