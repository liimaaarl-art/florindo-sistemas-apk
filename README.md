# Florindo Sistemas — APK Android

Aplicativo Android do **Florindo Sistemas**, empacotado com Capacitor e conectado ao backend Neon.

## APK automático

O GitHub Actions gera um APK Android de teste a cada atualização da branch `main`.

Para baixar:

1. Abra **Actions** no GitHub.
2. Entre na execução **Build Florindo Sistemas APK**.
3. No final da página, baixe o artifact **Florindo-Sistemas-APK**.
4. Dentro do ZIP estará o `app-debug.apk`.

Também é possível executar manualmente em **Actions → Build Florindo Sistemas APK → Run workflow**.

## Estrutura

- `.source/index.html.gz.b64.part.*` — aplicação Florindo Sistemas compactada em partes; o workflow reconstrói o `index.html` antes do build.
- `.github/workflows/build-apk.yml` — automação completa de geração do Android/APK.
- A logo Florindo Educação utilizada no aplicativo já está incorporada ao HTML e é convertida automaticamente no ícone e splash do Android.

## Aplicativo

- Nome: **Florindo Sistemas**
- App ID: `com.florindosistemas.central`
- Backend: **Neon**
- Plataforma Android: **Capacitor 8**

Os arquivos `android/`, `www/`, dependências Node e demais artefatos são gerados automaticamente pela Action e não precisam ficar versionados.
