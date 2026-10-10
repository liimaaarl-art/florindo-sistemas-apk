# Assistente Gemini

Servidor autenticado pela sessão existente do Florindo Sistemas. A chave Gemini fica somente no servidor.

## Ativar

Cadastre os secrets `GEMINI_API_KEY` e `NEON_API_KEY` em Settings → Secrets and variables → Actions. Execute Build Florindo Sistemas APK na branch main. O workflow publica `florindoai` no projeto Neon existente, recebe a URL e a incorpora no APK. Instale o APK atualizado.

O assistente cria e atualiza clientes, sistemas, versões, contratos e financeiro. Não exclui registros, transfere clientes, modifica arquivos nem executa SQL sugerido pelo modelo. Cada solicitação tem identificador para evitar duplicações. Em caso de dúvida, pergunta sem gravar.

As alterações são atômicas, validadas e registradas em `florindo_ai_history`. Essa tabela é privada (RLS sem políticas públicas). Não há mudanças na autenticação existente. Máximo de 20 comandos por sessão por hora. O serviço consulta os modelos disponíveis para a chave e prioriza Flash-Lite, com alternativas Flash.

Os testes de regras e sintaxe rodam no workflow Validate Gemini assistant. Testar a API real exige as duas chaves, publicação e uma sessão válida do aplicativo. Cotas gratuitas do Gemini dependem da conta e disponibilidade; erro de cota é exibido sem gravações parciais.
