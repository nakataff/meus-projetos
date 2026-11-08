# Web Push do De La Quadra

O GitHub Pages entrega a interface. O Worker consulta a ESPN uma vez por minuto e guarda as assinaturas do navegador e o histórico de envios em um Durable Object SQLite. O sino e os avisos dentro do site também funcionam sem o Worker, enquanto a página estiver aberta em primeiro plano.

## Ativar o envio

1. Nesta pasta, execute `npm ci` e `npx wrangler login` usando a conta Cloudflare que hospedará o serviço.
2. Gere um par VAPID com `npx web-push generate-vapid-keys`. Guarde a chave privada fora do repositório. Publique o Worker com `npx wrangler deploy`.
3. Configure `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` e `VAPID_SUBJECT` com `npx wrangler secret put NOME`. Use um contato válido em `VAPID_SUBJECT`, no formato `mailto:`. Preserve o par VAPID nos próximos deploys.
4. Coloque a URL HTTPS do Worker em `nba/js/alerts-config.mjs`, incremente a versão da importação desse arquivo em `nba/js/alerts.js` e publique o site. O botão **Ativar avisos com o site fechado** aparecerá no sino.
5. Teste com uma partida acompanhada ao vivo e confirme a entrega com o site fechado. No iPhone e iPad, adicione o site à Tela de Início, abra pelo ícone e ative pelo sino.

O cron usa os registros de jogo publicados pela ESPN. Cada jogo usa o mesmo identificador para alertas por time, jogador e transmissão, inclusive quando o usuário segue mais de uma dessas opções. O serviço só envia avisos recentes, em lotes de até 24 por minuto, e elimina assinaturas que o provedor informa como expiradas. A agenda do site agrupa ESPN e Disney+ e inclui o Prime Video quando informado.
