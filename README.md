# Bot WhatsApp Mercoplasa (MIA) - guia de deploy

O que ja esta pronto (feito na conta da Mercoplasa em 11/set/2026):

- App no Meta for Developers: **Mercoplasa Atendimento** (ID `959738180422983`), publicado.
- - Produto WhatsApp Business ja adicionado a esse app.
  - - Numero de teste gratuito reivindicado: `+1 (555) 186-5000`
    -   - Phone Number ID: `1269995032853150`
        -   - WhatsApp Business Account ID: `1066859042952450`
            - - Este numero de teste so envia mensagem para ate 5 numeros que voce cadastrar como destinatario de teste (e assim que a Meta libera de graca, sem verificacao da empresa). Da para testar o fluxo inteiro com o seu proprio celular antes de ir para o numero real.
             
              - O que falta - so voce (ou seu TI) consegue fazer, porque envolve criar conta em outro servico ou aprovar algo com sua identidade:
             
              - 1. Gerar o token de acesso (1 clique, gratis): Meta for Developers > app "Mercoplasa Atendimento" > Conectar no WhatsApp > Configuracao da API > Etapa 1 > botao **Gerar token**. Copie o valor.
                2. 2. Criar uma conta gratuita em um servico de hospedagem para este codigo rodar 24h (ele precisa de um endereco publico na internet para a Meta chamar). Sugestao: **Render.com** (plano Free, historicamente sem pedir cartao de credito - confirme ao criar a conta). Alternativas: Railway, Fly.io.
                   3. 3. Depois de publicar la, me avisa o link gerado (algo como `https://mercoplasa-bot.onrender.com`) que eu configuro o webhook dentro do Meta for Developers para voce (isso eu faco direto pela sua conta, sem precisar de senha nova).
                     
                      4. ## Passo a passo no Render (gratuito)
                     
                      5. 1. Crie uma conta em https://render.com (pode usar login do Google/GitHub).
                         2. 2. New + -> Web Service.
                            3. 3. Conecte este repositorio Git (mercoplasa-bot).
                               4. 4. Configuracao do servico:
                                  5.    - Build Command: `npm install`
                                        -    - Start Command: `npm start`
                                             - 5. Em "Environment", cadastre as variaveis do arquivo `.env.example` (troque `WHATSAPP_TOKEN` pelo token gerado no passo 1).
                                               6. 6. Deploy. Quando terminar, voce tera uma URL publica - e o seu webhook: `https://SEU-APP.onrender.com/webhook`.
                                                 
                                                  7. **Aviso importante sobre o plano gratuito:** ele "dorme" depois de 15 minutos sem receber acesso, e demora cerca de 1 minuto para acordar na primeira mensagem seguinte - ou seja, o primeiro cliente do dia pode esperar um pouco mais pela resposta automatica. Duas saidas, ambas sem custo: (a) usar um servico gratuito de "ping" (ex: cron-job.org) batendo em `/health` a cada 10 minutos para manter o servico acordado, ou (b) aceitar esse pequeno atraso inicial enquanto o volume for baixo.
                                                 
                                                  8. ## Configurando o webhook no Meta (eu faco isso com voce)
                                                 
                                                  9. Meta for Developers > Mercoplasa Atendimento > Conectar no WhatsApp > Configuracao > Webhook:
                                                  10. - Callback URL: `https://SEU-APP.onrender.com/webhook`
                                                      - - Verify Token: o mesmo valor que voce colocou em `VERIFY_TOKEN`
                                                        - - Campos de inscricao: marcar `messages`
                                                         
                                                          - ## Testando
                                                         
                                                          - 1. No painel "Configuracao da API > Etapa 1", adicione seu proprio celular como numero de destinatario de teste.
                                                            2. 2. Mande "oi" pelo WhatsApp para o numero de teste `+1 555 186-5000`.
                                                               3. 3. Voce deve receber o menu da MIA automaticamente.
                                                                 
                                                                  4. ## Indo para o numero real da Mercoplasa
                                                                 
                                                                  5. Isso e a "Etapa 2. Configuracao da producao" dentro do mesmo app - conecta o numero central de verdade no lugar do numero de teste. Duas coisas a considerar antes:
                                                                  6. - O numero escolhido nao pode estar simultaneamente logado no app comum do WhatsApp Business, a nao ser que se pague por um provedor com "Coexistencia" (nao e gratuito - pesquisei e comeca por volta de 49 euros/mes). Por isso, se quiser manter o app funcionando no celular do atendente, o caminho sem custo e usar um numero dedicado so para o bot.
                                                                     - - Para tirar o limite de mensagens e o aviso de "nao verificada", vale concluir a verificacao da empresa (Meta for Developers > Etapa 3, ou Configuracoes do Business Manager > Informacoes da empresa).
                                                                      
                                                                       - ## Setores e perguntas (edite direto no server.js se quiser ajustar o texto)
                                                                      
                                                                       - O arquivo `server.js` tem um array `SETORES` com o texto de cada opcao do menu e a pergunta de qualificacao de cada setor (Comercial, Financeiro, Logistica, Fiscal, Compras, RH). E so editar o texto ali - nao precisa mexer no resto do codigo.
                                                                       - 
