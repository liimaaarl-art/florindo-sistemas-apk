# Nexo

Gestão da operação para um estúdio de software: clientes, projetos, versões, contratos, financeiro, tarefas, agenda e um assistente em português.

Cada conta vê somente os próprios registros. A senha fica no provedor de autenticação, nunca no navegador. A chave da IA fica só no servidor.

## Módulos

- Início com indicadores, urgências, agenda, contratos a vencer e movimento recente
- Clientes com prontuário: projetos, contratos, financeiro, tarefas, agenda e histórico
- Projetos com ficha técnica e histórico de versões
- Contratos com alerta de vencimento e arquivo pequeno
- Financeiro com período, gráfico e totais por cliente e projeto
- Tarefas da empresa e pessoais, urgentes primeiro
- Agenda ligada a clientes
- Assistente que transforma um pedido em ação validada no servidor
- Busca única e backup JSON

## Dados

O esquema está em `migrations/`. Com `DATABASE_URL`, o app usa Postgres (Neon). Sem essa variável, a pré-visualização usa um Postgres embutido. Não crie arquivo `.env` e não versione segredos.

## Assistente e voz

O servidor chama a API da xAI com `XAI_API_KEY`. O modelo devolve JSON. O backend confere cada ação e só então grava. O microfone envia um áudio curto para transcrição no servidor; a chave não vai para o navegador.

## Android

`capacitor.config.json` prepara o empacotamento. Depois de publicar:

1. Coloque a origem `https` do app em `server.url`.
2. Instale `@capacitor/core`, `@capacitor/cli` e `@capacitor/android`.
3. Rode `npx cap add android`.
4. Garanta `INTERNET` e `RECORD_AUDIO` no manifesto. O fluxo em `.github/workflows/android-apk.yml` faz isso numa release, desde que o segredo `NEXO_SERVER_URL` exista.

O aplicativo Android é uma casca segura em cima do servidor publicado, então o login e os dados acompanham a conta.
