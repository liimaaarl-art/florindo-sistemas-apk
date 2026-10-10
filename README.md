# Florindo Sistemas — APK Android

Aplicativo Android do **Florindo Sistemas**, empacotado com Capacitor e conectado ao backend Neon.

## Acesso

O aplicativo agora abre com uma tela de login. A autenticação é validada no backend; a senha não fica gravada no HTML do aplicativo.

## Interface Android

O cabeçalho respeita a área segura da barra de status do celular, deixando o botão de menu abaixo do relógio e dos ícones do sistema.

## Gerar o APK

O GitHub Actions gera automaticamente um APK de teste (`app-debug.apk`) a cada push na branch `main` e também pode ser executado manualmente em **Actions → Build Florindo Sistemas APK → Run workflow**.

O APK gerado aparece como artifact chamado **Florindo-Sistemas-APK** na execução do workflow.
