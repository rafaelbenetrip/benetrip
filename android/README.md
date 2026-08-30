# Benetrip - App Android (TWA)

O app Android da Benetrip é um **Trusted Web Activity (TWA)**: um pacote nativo
que abre o site https://benetrip.com.br em tela cheia, usando o PWA já publicado.
Nada de código é duplicado — o app é uma casca; toda melhoria feita no site
aparece no app sem precisar de nova versão na loja.

## Arquivos

- `twa-manifest.json` — configuração do app (pacote `br.com.benetrip.app`,
  cores, ícones, atalhos). É a fonte de verdade para regenerar o projeto.
- `android.keystore` — **NÃO está no repositório** (ver `.gitignore`).
  É a chave de upload que assina o app. Guarde-a em local seguro junto
  com a senha; sem ela não é possível enviar atualizações com a mesma
  identidade de upload.
- `public/.well-known/assetlinks.json` (na raiz do site) — Digital Asset Links.

---

## Passo a passo de publicação

### Passo 0 — Antes de qualquer coisa: pendências do produto

**Exclusão de conta (obrigatório).** A Benetrip permite criar conta
(e-mail/senha, Google e link mágico — ver `public/assets/js/benetrip-auth.js`),
e hoje o usuário só consegue apagar itens individuais em "Minha Conta", não a
conta inteira. A política de Dados do Usuário do Google Play exige, para
qualquer app que permita criar conta:

1. um caminho **dentro do app** para solicitar a exclusão da conta e dos dados; e
2. uma **URL pública** de exclusão, declarada no formulário de Segurança dos Dados.

Sem isso o app é reprovado na revisão. É o único bloqueio real que resta —
resolver antes de enviar.

### Passo 1 — Conta de desenvolvedor (organização)

Com o D-U-N-S em mãos, criar/verificar a conta como **organização** em
https://play.google.com/console (taxa única de US$ 25).

Vantagem concreta: contas de organização verificadas com D-U-N-S são
**isentas** da regra de teste fechado com 12 testadores por 14 dias, que vale
para contas pessoais criadas depois de 13/11/2023. Ou seja, dá para ir direto
para produção, sem juntar testadores.

Concluir a verificação de identidade/organização **antes** de criar o app —
ela costuma levar alguns dias e trava o envio.

### Passo 2 — Conferir a chave de assinatura

Verificar se o `android.keystore` ainda existe e se o fingerprint bate com o
que está publicado em `public/.well-known/assetlinks.json`:

```bash
keytool -list -v -keystore android/android.keystore -alias benetrip | grep SHA256
```

Deve retornar `56:7A:D6:...:16:02`. Se **não** bater (ou se a keystore foi
perdida), gere uma nova e substitua o fingerprint no `assetlinks.json` —
como o app ainda não foi publicado, trocar a chave de upload agora não custa
nada. Depois de publicado, perder essa chave dá trabalho.

### Passo 3 — Gerar o AAB

Pré-requisitos: Node.js, JDK 17 e Android SDK (o Bubblewrap oferece instalar
os dois últimos automaticamente).

```bash
npm i -g @bubblewrap/cli   # use sempre a versão mais recente
cd android/
# coloque android.keystore nesta pasta
bubblewrap update   # regenera o projeto a partir do twa-manifest.json
```

**Antes de buildar, conferir o target API level.** Desde 31/08/2026 o Google
Play exige que apps novos tenham `targetSdkVersion 36` (Android 16). O template
do Bubblewrap ficou em 35 por um tempo, então confira o arquivo gerado:

```bash
grep -n "targetSdkVersion\|compileSdkVersion" android/app/build.gradle
```

Se aparecer `targetSdkVersion 35`, edite para `36` (e `compileSdkVersion 36`)
antes de continuar. Com 35 o AAB é rejeitado no upload, com mensagem explícita.

```bash
bubblewrap build    # gera app-release-bundle.aab assinado
```

Para cada nova versão, incremente `appVersionCode` (inteiro, +1) e
`appVersionName` (ex.: "1.1.0") no `twa-manifest.json` antes do build.

### Passo 4 — Criar o app na Play Console

Criar app → nome "Benetrip", idioma padrão pt-BR, tipo **App**, **Gratuito**.

### Passo 5 — Subir o AAB e fechar o Digital Asset Links

1. Enviar o `app-release-bundle.aab` em *Test and release → Production*
   (ou *Internal testing* primeiro, para validar em um aparelho real).
2. Com o Play App Signing (padrão), o Google **re-assina** o app com uma chave
   própria. Copiar o fingerprint em:

   > Play Console → Test and release → Setup → App signing →
   > "App signing key certificate" → SHA-256 certificate fingerprint

3. **Adicionar** esse fingerprint ao array `sha256_cert_fingerprints` do
   `public/.well-known/assetlinks.json` (mantendo o da chave de upload, usado
   nos testes locais) e fazer deploy do site.

Esse passo é o que faz o app abrir **sem a barra de navegador** no topo. Se for
esquecido, o app funciona mas parece um navegador embutido. Validar depois do
deploy:

```bash
curl -s https://benetrip.com.br/.well-known/assetlinks.json
```

### Passo 6 — Ficha da loja

- Descrição curta (até 80 caracteres) e completa (até 4000)
- Ícone 512×512 PNG
- Feature graphic 1024×500
- No mínimo 2 screenshots de celular (vale capturar o site no Chrome mobile;
  as telas mais fortes hoje são Descobrir Destinos, Voos Baratos e Roteiro)
- Categoria: Viagens e local

### Passo 7 — Declarações obrigatórias

- **Política de privacidade**: https://benetrip.com.br/privacidade
- **Segurança dos dados**: declarar e-mail e nome (login), histórico de buscas,
  destinos e roteiros salvos (Supabase); informar a URL de exclusão de conta
  criada no Passo 0
- **Classificação indicativa**: responder o questionário
- **Público-alvo**: adultos (não direcionado a crianças)
- **App de anúncios**: declarar conforme o uso atual de links de afiliados

### Passo 8 — Enviar para revisão

Com conta de organização verificada, a revisão costuma levar de alguns dias a
duas semanas na primeira publicação.

---

## Depois de publicado

Melhorias no site entram no app automaticamente — só é preciso gerar um novo
AAB quando mudar algo do próprio pacote: ícone, nome, cores, atalhos,
`targetSdkVersion` ou permissões.

Os atalhos do app (`shortcuts`, tanto aqui quanto em
`public/manifest.webmanifest`) apontam para URLs finais do site. Se uma rota
for renomeada e passar a redirecionar (como aconteceu com
`/create-itinerary` → `/roteiro-viagem`), atualize os dois arquivos.
