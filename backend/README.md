# K-Mestre AI — Backend

API, terminais (PTY), orquestrador e banco de dados do **K-Mestre AI**. Web-based, funciona em qualquer sistema operacional.

## Requisitos

- [Node.js 20+](https://nodejs.org/)
- Git (para clonar)

## Como usar ao baixar

```bash
git clone https://github.com/gabrielkramermota/k-mestre-ai.git
cd k-mestre-ai/backend

npm install          # instala dependências e gera o Prisma Client
npm run db:seed      # cria o banco (schema direto) + usuário inicial: admin / admin
npm run dev          # sobe em http://localhost:8080
```

O banco é criado **automaticamente** com `prisma db push` (sem necessidade de arquivos de migration). Se já existe um banco (`data/app.db`), basta `npm install && npm run dev`.

### Credenciais iniciais

| Usuário | Senha |
|---------|-------|
| `admin` | `admin` |

> Troque a senha após o primeiro acesso (frontend → Configurações → Conta) ou crie outros usuários com `npm run create-user -- --username <nome> --password <senha>`.

## Como ligar com o frontend

O backend escuta em `http://localhost:8080` (configurável via `PORT` no `backend/.env`).

| Modo | Como o frontend acessa |
|------|------------------------|
| **Desenvolvimento** | Frontend roda em `http://localhost:5173` e faz **proxy** de `/api` e `/ws` para `http://localhost:8080` (configurado em `frontend/vite.config.ts`, sobreposto por `frontend/.env`). |
| **Produção** | `npm run build` no frontend gera `frontend/dist`; o backend **serve esse build** na própria porta 8080. Rode `npm run start` aqui e acesse `http://localhost:8080` direto. |

Ordem recomendada no dia a dia:

1. Terminal 1: `cd backend && npm run dev`
2. Terminal 2: `cd frontend && npm run dev`
3. Acesse `http://localhost:5173`

## Scripts

| Script | O que faz |
|--------|-----------|
| `npm run dev` | Sobe o servidor com `ts-node` |
| `npm run build` | Compila TypeScript para `dist/` |
| `npm run start` | Roda o build (`node dist/server.js`) |
| `npm run create-user` | Cria usuário: `-- --username X --password Y` |
| `npm run db:seed` | Cria o banco (schema direto) + usuário `admin/admin` |

## Configuração de ambiente (`backend/.env`)

```bash
cp .env.example .env
```

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `DATABASE_URL` | `file:./data/app.db` | SQLite ou PostgreSQL (`postgresql://usuario:senha@host:5432/db`) |
| `PORT` | `8080` | Porta do servidor |

### Modo PostgreSQL (opcional)

```bash
docker compose up -d    # sobe o Postgres (credenciais default kmestre/kmestre)
```

Depois aponte `DATABASE_URL` no `.env` para o Postgres e rode `npm run db:seed` (cria as tabelas via `prisma db push` e o usuário inicial).

## Estrutura

```
backend/
├── src/
│   ├── server.ts              # entrada: rotas HTTP, WebSocket, boot
│   ├── db.ts                  # Prisma Client (SQLite ou Postgres) + migrate
│   ├── auth.ts                # hash de senha, sessões, cookies
│   ├── terminal-registry.ts   # spawn/gestão de PTYs (node-pty)
│   ├── orchestrator-routes.ts # API interna dos terminais (kmestre)
│   ├── roles.ts               # gera role.json + AGENTS.md/CLAUDE.md por papel
│   ├── cli-shim.ts            # cria o shim `kmestre.cmd` no PATH dos terminais
│   └── cli/kmestre.ts         # CLI `kmestre` (list/send/check/note)
├── prisma/
│   ├── schema.prisma          # schema SQLite
│   ├── schema.postgres.prisma # schema PostgreSQL
│   └── seed.ts                # usuário admin/admin
├── docker-compose.yml         # PostgreSQL opcional
├── data/                      # SQLite + dados por usuário (criado em runtime)
└── .env.example
```

## Portas e WebSocket

- HTTP: `http://localhost:8080`
- WebSocket dos terminais: `ws://localhost:8080/ws/terminal?terminalId=...&workspace=...&shell=powershell`

O orquestrador expõe `/api/orchestrator/*` para a CLI `kmestre` dentro dos terminais (autenticada por token de terminal).