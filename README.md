# K-Mestre AI

<p align="center"><img src="frontend/public/logo.png" width="220" alt="K-Mestre AI" /></p>

> Um **orquestrador de IA** visual: uma "mesa de trabalho" que conecta agentes de IA, terminais e notas em um canvas compartilhado. Projeto open source.

![Demonstração](frontend/public/demonstracao.jpeg)

> 🚧 **Em desenvolvimento** — este projeto está em constante evolução, então novas atualizações e funcionalidades virão por aqui. Fique de olho! ⭐

## 📋 Índice

- [O que é](#-o-que-é)
- [Para que serve uma mesa de trabalho com agentes de IA?](#-para-que-serve-uma-mesa-de-trabalho-com-agentes-de-ia)
- [Funcionalidades](#-funcionalidades)
- [Tecnologias](#-tecnologias)
- [Como usar](#-como-usar)
- [Configuração](#-configuração)
- [Modo PostgreSQL](#-modo-postgresql)
- [Licença](#-licen%C3%A7a)

---

## 💡 O que é

O K-Mestre AI é um canvas onde você monta a sua equipe de agentes:

| Elemento | Descrição |
|----------|-----------|
| **Terminais** | PTY reais rodando no seu PC, cada um em um diretório de trabalho. Cada terminal vira um "agente" com um papel (role) e um prompt. |
| **Notas** | Documentos Markdown compartilhados entre os agentes conectados. |
| **Árvore de arquivos** | Navegação rápida pelos arquivos do workspace. |
| **Conexões** | Ligue terminais com arestas para que eles conversem entre si (via CLI `kmestre`). |

Tudo roda **100% local** no seu computador. O backend sobe os PTYs, o frontend é a interface, e o orquestrador faz a ponte entre eles.

**Foco:** Web — roda no navegador e funciona em qualquer sistema operacional (Windows, Linux, macOS).
**Requisitos:** [Node.js 20+](https://nodejs.org/), [Git](https://git-scm.com/).

---

## 🤖 Para que serve uma mesa de trabalho com agentes de IA?

Imagine que você é o **líder de desenvolvimento** de uma empresa e precisa entregar um projeto. Na vida real, você não faz tudo sozinho: você **passa as demandas** para os seus times — o designer cria a interface, o engenheiro de software codifica, o QA testa, o planejador organiza as tarefas.

O K-Mestre AI traz essa mesma lógica para os seus agentes de IA, em uma **mesa de trabalho visual**:

### A analogia da empresa

| Papel | Na empresa | No K-Mestre AI |
|-------|------------|-----------------|
| **Líder** (você) | Define o objetivo do projeto e distribui as demandas | Cria o **Maestro** e passa a missão geral |
| **Maestro** | Líder técnico que gerencia os times | Terminal promovido a **maestro**, que repassa demandas e cobra resultados |
| **Engenheiro de software** | Escreve o código | Terminal com papel (role) de desenvolvedor |
| **Designer** | Cria as interfaces | Terminal com papel de UI/UX |
| **QA** | Testa e valida | Terminal com papel de testador |
| **Planejador** | Organiza e prioriza | Terminal com papel de gerente de projeto |

O **Maestro** é o coração da orquestração: ele **recebe a demanda do objetivo do projeto** e **envia para o especialista certo**, acompanha a execução e, quando necessário, **repassa o trabalho para outro especialista** — exatamente como um líder que delega para o time certo.

### Como seria sem um orquestrador?

| | Sem orquestração | Com o K-Mestre AI |
|--|------------------|--------------------|
| **Demandas** | Você abre vários chats e copia/cola manualmente cada tarefa | Uma só mensagem ao Maestro, que distribui para os especialistas |
| **Comunicação** | Não há — cada agente trabalha isolado | Agentes se conectam e trocam mensagens pela CLI `kmestre` |
| **Contexto** | Cada agente começa do zero | Notas e arquivos compartilhados mantêm o contexto entre todos |
| **Entrega** | Você junta as partes na mão | Cada especialista entrega pronto, e você visualiza tudo no canvas |

### 🎯 E no final de tudo, ele te entrega tudo pronto para você visualizar.

Você acompanha o progresso **em tempo real** no canvas: cada terminal mostra sua saída, cada conexão mostra quem está falando com quem, e as notas guardam as decisões. Quando a equipe termina, o resultado está **organizado e pronto** — você não precisa caçar respostas espalhadas por chats, apenas visualiza o que foi entregue.

---

## ✨ Funcionalidades

- **Canvas visual** (React Flow) com nós de terminal, nota e árvore de arquivos
- **Terminais interativos** (xterm.js) com resize, persistência e reconexão
- **Multiusuário** com login por senha (sessão via cookie)
- **Multi-workspace** com layouts salvos por workspace
- **Sistema de papéis (roles)** — crie um papel com prompt, cor e diretório de trabalho
- **CLI `kmestre`** embutida nos terminais para os agentes se comunicarem:

| Comando | O que faz |
|---------|-----------|
| `kmestre list` | Lista colegas conectados e notas compartilhadas |
| `kmestre send <alvo> "<mensagem>"` | Envia uma demanda a um colega |
| `kmestre check <alvo>` | Lê a saída recente de um colega |
| `kmestre note read\|write\|create` | Lê, edita e cria notas compartilhadas |

- **Notas** com editor Markdown + preview (GFM)
- **Banco de dados** via SQLite (padrão, zero configuração) ou PostgreSQL (opcional, via Docker)

---

## 🛠️ Tecnologias

| Camada | Tecnologias |
|--------|-------------|
| **Frontend** | React, Vite, React Flow, xterm.js, lucide-react |
| **Backend** | Node.js, Express, WebSocket (`ws`), node-pty |
| **Banco de dados** | Prisma + SQLite (padrão) ou PostgreSQL |
| **CLI** | TypeScript (`ts-node`) |

---

## 🚀 Como usar

### 1. Baixe o projeto

```bash
git clone https://github.com/gabrielkramermota/k-mestre-ai.git
cd k-mestre-ai
```

### 2. Suba o backend

```bash
cd backend
npm install                # instala dependências e gera o Prisma Client
npm run db:seed            # cria o banco + usuário inicial
npm run dev                # sobe em http://localhost:8080
```

### 3. Suba o frontend

```bash
cd frontend
npm install
npm run dev                # sobe em http://localhost:5173
```

Acesse **http://localhost:5173** no navegador e entre com as credenciais abaixo.

> **Produção:** `npm run build` no frontend e `npm run start` no backend — o backend serve o frontend compilado na mesma porta (8080).

### 🔑 Credenciais iniciais

| Campo | Valor |
|-------|-------|
| **Usuário** | `admin` |
| **Senha** | `admin` |

> **Importante:** troque a senha logo após o primeiro acesso (menu **Configurações → Conta**). Você também pode criar outros usuários com:
> `npm run create-user -- --username <nome> --password <senha>`

---

## ⚙️ Configuração

### Backend (`backend/.env`)

```bash
cp backend/.env.example backend/.env
```

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `PORT` | `8080` | Porta do backend |
| `DATABASE_URL` | `file:./data/app.db` | Conexão SQLite ou PostgreSQL |

### Frontend (`frontend/.env`)

```bash
cp frontend/.env.example frontend/.env
```

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `VITE_API_URL` | `http://localhost:8080` | URL base da API |
| `VITE_WS_URL` | derivada de `VITE_API_URL` | URL do WebSocket |

### Scripts úteis (backend)

| Script | O que faz |
|--------|-----------|
| `npm run dev` | Sobe o servidor com `ts-node` |
| `npm run build` | Compila TypeScript para `dist/` |
| `npm run start` | Roda o build (`node dist/server.js`) |
| `npm run create-user` | Cria usuário: `-- --username X --password Y` |
| `npm run db:seed` | Cria o banco (schema direto) + usuário `admin/admin` |

---

## 🐘 Modo PostgreSQL (opcional)

Prefere PostgreSQL em vez de SQLite? Siga estes passos:

```bash
cd backend
docker compose up -d                    # sobe o Postgres
# no backend/.env:
DATABASE_URL="postgresql://kmestre:kmestre@localhost:5432/kmestre"
npm run db:seed                         # cria as tabelas + usuário inicial
```

---

## 📄 Licença

Open source. Consulte o arquivo [LICENSE](./LICENSE) para os termos de uso.

---

## ⭐ Apoie o projeto

Se você gostou do **K-Mestre AI**, considere adicionar o projeto aos favoritos com uma **⭐ Star**! Isso ajuda muito na divulgação e motiva o desenvolvimento de novas funcionalidades.

<a href="https://github.com/gabrielkramermota/k-mestre-ai">
  <img align="center" src="https://api.star-history.com/svg?repos=gabrielkramermota/k-mestre-ai&type=Date" alt="Histórico de estrelas do K-Mestre AI" width="600" />
</a>

> O histórico de estrelas é atualizado automaticamente pelo [star-history.com](https://star-history.com).

---

<p align="center">Feito com 💙 e muito terminal · <a href="https://www.linkedin.com/in/gabriel-kramer-desenvolvedor/">Gabriel Kramer Mota</a></p>