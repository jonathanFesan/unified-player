<p align="center">
  <img src="app/icon.svg" width="112" alt="Logo UPlayed" />
</p>

<h1 align="center">UPlayed — Spotify + YouTube</h1>

Player de música web que busca no **Spotify** e no **YouTube** ao mesmo tempo e toca faixas das duas fontes numa **fila híbrida contínua**, com um único controlador na barra inferior.

**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · Zustand · Lucide React

---

## Início rápido

```bash
npm install
cp .env.example .env.local     # preencha as 3 variáveis (guia abaixo)
npm run dev
```

Abra **http://127.0.0.1:3000** (e não `localhost` — veja o porquê na seção do Spotify).
Se você abrir `localhost:3000`, o app redireciona sozinho para `127.0.0.1:3000`.

---

## 1. Chaves do Spotify (Spotify Developer Dashboard)

1. Acesse **https://developer.spotify.com/dashboard** e faça login.
2. Clique em **Create app** e preencha:
   - **App name / description:** qualquer valor.
   - **Redirect URIs:** adicione exatamente:
     ```
     http://127.0.0.1:3000/callback
     ```
     Para produção, adicione também: `https://SEU-DOMINIO.com/callback`
   - **Which API/SDKs are you planning to use?** marque **Web API** e **Web Playback SDK**.
3. Salve, abra **Settings** e copie o **Client ID** para `NEXT_PUBLIC_SPOTIFY_CLIENT_ID`.
   O **Client Secret não é usado**: o login usa OAuth 2.0 com **PKCE**, que roda inteiro no navegador.
4. Em **User Management**, adicione o e-mail da conta Spotify de cada pessoa que vai usar o app. Apps em *Development mode* só aceitam usuários cadastrados ali; os outros recebem erro 403.

> **Por que `127.0.0.1` e não `localhost`?** O Spotify não aceita mais `localhost` em Redirect URIs. Só aceita HTTPS ou um endereço de loopback explícito (`127.0.0.1` / `[::1]`). Além disso, o `code_verifier` do PKCE fica no `localStorage` da origem. Por isso o login precisa começar na mesma origem da Redirect URI.

| Variável | Valor em dev |
|---|---|
| `NEXT_PUBLIC_SPOTIFY_CLIENT_ID` | Client ID do dashboard |
| `NEXT_PUBLIC_SPOTIFY_REDIRECT_URI` | `http://127.0.0.1:3000/callback` |

### Premium vs. Free

| Conta | Como as faixas do Spotify tocam |
|---|---|
| **Premium** | Faixa completa via **Web Playback SDK**. O navegador vira um dispositivo Spotify Connect chamado "UPlayed (Web)". |
| **Free** ou sem login | **Prévia de 30s** quando o Spotify fornece `preview_url`. Quando não fornece, o app busca a mesma música no YouTube e toca essa versão, avisando na tela. |

> O Spotify deixou de fornecer `preview_url` para apps criados depois de nov/2024. Na prática, contas Free quase sempre caem no fallback do YouTube.
> O Web Playback SDK funciona em navegadores **desktop**. Em navegadores móveis o app também usa o fallback.

---

## 2. Chave do YouTube (Google Cloud Console)

1. Acesse **https://console.cloud.google.com/** e crie (ou selecione) um projeto.
2. Vá em **APIs & Services → Library**, procure **YouTube Data API v3** e clique em **Enable**.
3. Vá em **APIs & Services → Credentials → Create credentials → API key**.
4. Clique na chave criada e restrinja o uso:
   - **Application restrictions → Websites**, adicionando:
     ```
     http://127.0.0.1:3000/*
     http://localhost:3000/*
     https://SEU-DOMINIO.com/*
     ```
   - **API restrictions → Restrict key → YouTube Data API v3**.
5. Copie a chave para `NEXT_PUBLIC_YOUTUBE_API_KEY`.

O YouTube **não usa Redirect URI**, porque a busca usa só a API key e o IFrame Player é público.

> **Cota:** cada busca custa cerca de 101 unidades (`search.list` = 100 + `videos.list` = 1). A cota padrão é de **10.000 unidades por dia**, o que dá cerca de 99 buscas. Por isso a busca só dispara ao apertar **Enter**, e resultados repetidos ficam em cache durante a sessão.

---

## Arquitetura

```
app/
  layout.tsx            Layout raiz (dark) + <Providers/>
  page.tsx              Header + busca + resultados + fila + player
  callback/page.tsx     Retorno do OAuth do Spotify (troca code → token)
components/
  PlayerBar.tsx         Controlador global fixo (play/pause, prev/next, progresso, volume, repeat)
  QueuePanel.tsx        Fila híbrida (sidebar em xl, drawer no mobile)
  SearchBar.tsx         Barra de busca unificada
  SearchResults.tsx     Abas Tudo / Spotify / YouTube (lado a lado em telas grandes)
  TrackRow.tsx          Linha de resultado (tocar agora, tocar a seguir, adicionar à fila)
  YouTubeHost.tsx       Container do IFrame do YouTube (mini-player minimizável)
  SpotifyAccount.tsx    Login/logout e status Premium/SDK
  SourceBadge.tsx, Slider.tsx, StatusToast.tsx, Welcome.tsx, icons.tsx, Providers.tsx
hooks/
  usePlayer.ts          Bootstrap do player, atalhos de teclado, Media Session API
  useUnifiedSearch.ts   Busca paralela nas duas fontes, com status e erro por fonte
lib/
  spotify/auth.ts       OAuth PKCE: login, troca do code, refresh automático
  spotify/api.ts        Web API: /me, /search, /me/player/play
  youtube/api.ts        Data API v3: search + durações
  player/
    types.ts            Interface PlaybackEngine (contrato comum)
    spotify-engine.ts   Web Playback SDK
    preview-engine.ts   <audio> HTML5 para prévias de 30s
    youtube-engine.ts   IFrame Player API
    controller.ts       PlayerController: escolhe o motor de cada faixa e alterna entre eles
  store/
    player-store.ts     Zustand: fila, índice, estado de reprodução, volume (persistido)
    auth-store.ts       Zustand: sessão e usuário do Spotify
types/                  Tipos compartilhados (Track, QueueItem, ...)
```

### Como o player alterna entre as APIs

1. As ações da fila (`playNow`, `next`, `playAt`...) só mudam o **store** e incrementam `loadId`.
2. O `PlayerController` observa `loadId`, pausa o motor anterior e escolhe o próximo:
   - faixa do YouTube → `YouTubeEngine`
   - faixa do Spotify com conta Premium → `SpotifyEngine` (SDK)
   - faixa do Spotify com conta Free ou sem login → `PreviewEngine`, ou `YouTubeEngine` com o vídeo equivalente
3. Os motores devolvem eventos (`playing`, `ended`, `error`) ao controller, que atualiza o store. Quando uma faixa termina, a próxima da fila começa, mesmo se for de outra fonte.

Os componentes de UI só leem o store e chamam `playerActions`. Eles não sabem qual API está tocando.

### Atalhos
- `/` foca a busca
- `Espaço` toca ou pausa
- `Shift + →` / `Shift + ←` vão para a próxima ou a anterior
- Teclas de mídia e os controles da tela de bloqueio funcionam via Media Session API

---

## Observações

- **Termos do YouTube:** o vídeo aparece num mini-player flutuante. O botão de minimizar só tira o player da tela, sem destruí-lo, para o áudio continuar. As políticas da YouTube API pedem que o player fique visível, então avalie isso antes de publicar o app.
- **Fim de faixa no Spotify:** o SDK não emite um evento `ended`. O fim é detectado pelo `player_state_changed`, e o app pausa o "autoplay/rádio" do Spotify para seguir a fila daqui.
- **Persistência:** a fila, o volume e o modo de repetição ficam salvos no `localStorage`. Os tokens do Spotify também ficam no `localStorage`, o que é aceitável para um app só de cliente com PKCE.
- **Deploy (Vercel etc.):** defina as três variáveis no painel do provedor. Troque `NEXT_PUBLIC_SPOTIFY_REDIRECT_URI` para `https://SEU-DOMINIO.com/callback` e cadastre essa mesma URI no Spotify Dashboard.

## Scripts

| Comando | Descrição |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm start` | Sobe o build |
| `npm run typecheck` | Checagem de tipos |

## Executável para Windows (opcional)

Gera uma pasta portátil `dist\UnifiedPlayer\` com `UnifiedPlayer.exe`, que sobe o servidor local e abre o app numa janela do Edge (não precisa de Node instalado em quem for usar).

```powershell
# com o .env.local já preenchido
powershell -ExecutionPolicy Bypass -File desktop\build-exe.ps1
```

> ⚠️ O build embute as suas chaves (`NEXT_PUBLIC_*`) no JavaScript gerado. Por isso `dist/` e `.next/` ficam fora do git. Se for distribuir o `.exe`, lembre que quem recebe consegue ler o Client ID e a API key — mantenha a chave do YouTube restrita (passo 2.4).

## Segurança

- Nunca versione o `.env.local` (já está no `.gitignore`).
- O app não usa nenhum segredo de servidor: o Spotify usa PKCE (sem Client Secret) e a chave do YouTube é pública por natureza, então **restrinja-a** por HTTP referrer e por API no Google Cloud Console.

## Licença

[MIT](LICENSE)
