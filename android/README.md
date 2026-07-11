# Benetrip - App Android (TWA)

O app Android da Benetrip é um **Trusted Web Activity (TWA)**: um pacote nativo
que abre o site https://benetrip.com.br em tela cheia, usando o PWA já publicado.

## Arquivos

- `twa-manifest.json` — configuração do app (pacote `br.com.benetrip.app`,
  cores, ícones, atalhos). É a fonte de verdade para regenerar o projeto.
- `android.keystore` — **NÃO está no repositório** (ver `.gitignore`).
  É a chave de upload que assina o app. Guarde-a em local seguro junto
  com a senha; sem ela não é possível enviar atualizações com a mesma
  identidade de upload.

## Como gerar o app (AAB) novamente

Pré-requisitos: Node.js, JDK 17 e Android SDK (o Bubblewrap oferece
instalar os dois últimos automaticamente).

```bash
npm i -g @bubblewrap/cli
cd android/
# coloque android.keystore nesta pasta
bubblewrap update   # regenera o projeto a partir do twa-manifest.json
bubblewrap build    # gera app-release-bundle.aab assinado
```

Para cada nova versão, incremente `appVersionCode` (inteiro, +1) e
`appVersionName` (ex.: "1.1.0") no `twa-manifest.json` antes do build.

## Digital Asset Links

O arquivo `public/.well-known/assetlinks.json` prova ao Android que o app
e o site pertencem ao mesmo dono — é o que faz o app abrir SEM a barra de
navegador. Ele contém o fingerprint SHA-256 do certificado de assinatura.

**Importante:** ao publicar na Play Console com *Play App Signing* (padrão),
o Google re-assina o app com uma chave própria. Depois de criar o app na
Play Console, copie o fingerprint em:

> Play Console → Test and release → Setup → App signing →
> "App signing key certificate" → SHA-256 certificate fingerprint

e **adicione** esse fingerprint ao array `sha256_cert_fingerprints` do
`assetlinks.json` (mantendo o da chave de upload, usado para testes locais).

## Checklist de publicação na Play Console

1. Criar conta de desenvolvedor (US$ 25, taxa única): https://play.google.com/console
2. Criar app → nome "Benetrip", idioma pt-BR, tipo App, gratuito
3. Subir o `app-release-bundle.aab` em Test and release → Production
   (ou Internal testing primeiro, recomendado)
4. Copiar o SHA-256 do App signing (ver seção acima) para o `assetlinks.json`
   e fazer deploy do site
5. Preencher a ficha da loja: descrição, ícone 512x512, feature graphic
   1024x500, ao menos 2 screenshots de celular
6. Preencher Data safety, Content rating e Privacy policy
   (usar https://benetrip.com.br/privacidade)
7. Enviar para revisão
