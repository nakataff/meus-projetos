# Conectar o Firebase ao QUADRA (sem pagar)

O QUADRA continua funcionando pelo GitHub Pages e usando JSONs estáticos para calendário, elencos e estatísticas. O Firebase é **somente** para login Google e salvar suas notas, comentários, jogadores favoritos, MVPs, quintetos e preferências.

## 1. Criar o projeto Firebase

1. Acesse https://console.firebase.google.com/ e escolha **Criar projeto**.
2. Nome sugerido: **nakataff-projetos** ou **quadra-nba**.
3. Selecione o plano **Spark (gratuito)**. Não precisa adicionar cartão.
4. O Google Analytics é opcional e não é necessário para o QUADRA.

## 2. Criar o app Web

1. No painel do projeto, clique no ícone **Web (`</>`)**, dentro de **Adicionar aplicativo**.
2. Nomeie como **QUADRA**. Não é necessário ativar Firebase Hosting, pois já usamos GitHub Pages.
3. Na configuração do SDK, escolha **Usar CDN** ou **Configuração** e copie o objeto JavaScript `firebaseConfig`.
4. No repositório GitHub, abra [nba/firebase-config.js](../firebase-config.js), clique em **Editar** (lápis), substitua `null` pelo objeto obtido no console e faça o commit.

Exemplo (NÃO use estes valores):

```js
window.QUADRA_FIREBASE_CONFIG = {
  apiKey: "AIza...",
  authDomain: "seu-projeto.firebaseapp.com",
  projectId: "seu-projeto",
  storageBucket: "seu-projeto.firebasestorage.app",
  messagingSenderId: "00000000000",
  appId: "1:00000000000:web:exemplo"
};
```

**A configuração Web é pública e não é senha**, mas NUNCA envie nem publique um arquivo de conta de serviço (`serviceAccountKey.json`), `private_key`, tokens ou credenciais do Google Cloud.

## 3. Habilitar Login Google

1. Firebase → **Authentication → Sign-in method**.
2. Ative o provedor **Google**, escolha o e-mail de suporte e salve.
3. Vá em **Authentication → Settings → Authorized domains**.
4. Adicione **`nakataff.github.io`** (somente o domínio, sem `https://` ou `/meus-projetos/nba/`).

## 4. Criar Firestore e proteger registros

1. No Firebase → **Firestore Database → Create database**.
2. Escolha a edição **Standard** e o banco **(default)**, no plano Spark.
3. Escolha uma região, por exemplo São Paulo, se a opção estiver disponível. Essa escolha é permanente.
4. Inicie no **modo de produção/restrito**. Não deixe regras públicas de testes.
5. Abra **Firestore Database → Rules**, copie integralmente o arquivo [firestore.rules](./firestore.rules) e clique em **Publicar**.

As regras permitem ler/escrever apenas os registros do próprio usuário autenticado sob `users/<uid>/quadra/*`.

## 5. Testar

1. Abra o endereço **https://nakataff.github.io/meus-projetos/nba/** depois do GitHub Pages atualizar.
2. Clique em **Entrar com Google**, aceite a autenticação e espere a confirmação de sincronização.
3. Marque um jogo como assistido, salve uma nota ou favorite um jogador.
4. Abra o mesmo link no celular e faça login **com a mesma conta Google**.
5. O histórico aparecerá após a sincronização.

Se surgir `auth/unauthorized-domain`, revise a etapa 3. Se aparecer `permission-denied`, revise o banco e as regras de segurança. Se não funcionar no celular, permita o pop-up do Google no navegador.

## Como o sistema protege os dados

- Antes da primeira sincronização, uma cópia local de recuperação é mantida na chave `quadra_cloud_pre_sync_backup_v1`, quando houver espaço.
- O backup JSON do QUADRA continua disponível e **deve ser baixado antes de migrar**.
- Dados salvos no HTML local em `file://` ficam em outra origem do navegador. Para levá-los ao GitHub Pages, exporte o backup do HTML local e importe no site publicado antes de conectar sua conta.
- O sistema tenta mesclar registros do aparelho e da nuvem pela data de atualização; edições simultâneas de dados iguais em dois aparelhos podem exigir revisão. A cópia de backup deve ser guardada.
- Em caso de falha de rede, o QUADRA continua salvando localmente e tenta sincronizar novamente quando a conexão voltar.
- A opção **Sair** desconecta o Google, mas mantém dados locais no dispositivo (não use isso como proteção em celular compartilhado).
- Calendário, estatísticas e elencos não são enviados ao Firestore; ficam em JSON no GitHub.
- As regras estão versionadas no GitHub, mas **não são publicadas automaticamente**: precisam ser coladas no console do Firebase.

## Custo gratuito

O plano Spark do Firestore permite um banco gratuito com limites como 1 GiB de armazenamento, 50 mil leituras/dia e 20 mil escritas/dia. Isso costuma ser muito mais que suficiente para um diário pessoal da NBA, mas os limites podem mudar. Se o limite do Spark acabar, o serviço poderá ser restringido temporariamente; **não é necessário mudar para Blaze**.

Documentação oficial: https://firebase.google.com/docs/projects/billing/firebase-pricing-plans

Este é um projeto pessoal não afiliado à NBA, ESPN ou Firebase.
