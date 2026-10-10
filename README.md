# Florindo Sistemas — APK Android

Aplicativo Android do **Florindo Sistemas**, empacotado com Capacitor e conectado ao backend Neon.

## Gerar o APK

O GitHub Actions gera automaticamente um APK de teste (`app-debug.apk`) a cada push na branch `main` e também pode ser executado manualmente em **Actions → Build Florindo Sistemas APK → Run workflow**.

## Estrutura

- `index.html` — aplicação Florindo Sistemas
- `icon.png` — ícone do aplicativo
- `.github/workflows/build-apk.yml` — automação de build Android

O APK gerado aparece como artifact chamado **Florindo-Sistemas-APK** na execução do workflow.
