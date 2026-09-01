# K-Mestre AI — Frontend

Interface visual (canvas) do **K-Mestre AI**: terminais, notas e árvore de arquivos conectados em um canvas compartilhado. Feito com React + Vite + React Flow + xterm.js.

## Requisitos

- [Node.js 20+](https://nodejs.org/)
- Backend rodando (ver `backend/README.md`)

## Como usar ao baixar

```bash
git clone https://github.com/gabrielkramermota/k-mestre-ai.git
cd k-mestre-ai/frontend

npm install
npm run dev          # sobe em http://localhost:5173
```

Acesse **http://localhost:5173** no navegador e entre com `admin` / `admin` (ou o usuário que você criou).

## Como ligar com o backend

Em desenvolvimento, o Vite faz **proxy** de `/api` e `/ws` para o backend (padrão `http://localhost:8080`). Basta o backend estar rodando:

```bash
# Terminal 1 — backend
cd backend && npm run dev        # http://localhost:8080

# Terminal 2 — frontend
cd frontend && npm run dev       # http://localhost:5173
```

### Configuração de ambiente (`frontend/.env`)

Opcional — os padrões já apontam para o backend local. Se quiser mudar o endereço do backend:

```bash
cp .env.example .env
```

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `VITE_API_URL` | `http://localhost:8080` | URL base da API (proxy de `/api`) |
| `VITE_WS_URL` | derivada de `VITE_API_URL` | URL do WebSocket (proxy de `/ws`) |

## Build de produção

```bash
npm run build
```

O resultado sai em `dist/`. O backend **serve esse build automaticamente** na porta dele (8080) — depois do build, basta rodar `npm run start` no backend e acessar `http://localhost:8080` (não precisa subir o Vite).

## Scripts

| Script | O que faz |
|--------|-----------|
| `npm run dev` | Sobe o servidor de desenvolvimento (HMR) |
| `npm run build` | Gera o bundle de produção em `dist/` |
| `npm run preview` | Pré-visualiza o build localmente |
| `npm run lint` | Roda o ESLint |

## Estrutura

```
frontend/
├── src/
│   ├── main.tsx            # entrada do React
│   ├── app.tsx             # canvas principal (React Flow) + sidebar
│   ├── api.ts              # cliente HTTP da API do backend
│   └── components/
│       ├── terminal-node.tsx       # nó de terminal (xterm.js)
│       ├── terminal-launch-modal.tsx  # criar/abrir terminal
│       ├── note-node.tsx           # nó de nota (Markdown + preview)
│       ├── file-tree-node.tsx      # nó de árvore de arquivos
│       ├── login-page.tsx          # tela de login
│       ├── new-workspace-modal.tsx # criar workspace
│       ├── settings-modal.tsx      # conta + preferências
│       └── ...
├── index.html
├── vite.config.ts          # proxy /api e /ws → backend
└── .env.example
```

## Observações

- O canvas salva o layout por workspace (nós, posições e conexões) no backend.
- Terminais continuam vivos no backend mesmo se você fechar a aba; reabrir reconecta no mesmo terminal.