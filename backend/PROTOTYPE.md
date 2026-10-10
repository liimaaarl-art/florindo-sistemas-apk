# Acesso direto para testes

A pedido do proprietário, o APK de teste abre sem a tela de login. Neon e Gemini usam uma sessão criada na compilação. A chave que permite emitir sessões é aleatória por publicação, fica apenas no servidor e no ambiente do GitHub Actions e nunca entra no APK ou no repositório.

A sessão embutida permite acesso aos dados e dura 90 dias. É uma versão para uso privado do proprietário; quem receber o APK terá acesso ao mesmo espaço. Não distribuir a clientes antes de reativar o login. Antes da versão final, remover o provisionamento de protótipo, revogar as sessões e ativar autenticação individual.

As chamadas de dados passam pelo servidor com validação da sessão, sem depender do JWT da Data API. O build confere a conexão ao Neon antes de gerar o APK. O cadastro no Resend não é necessário para usar esta versão.
