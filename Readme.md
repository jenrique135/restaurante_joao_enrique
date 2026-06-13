# MarmitaTech Pro
### Sistema de Gestão de Marmitas — v1.0.0
*Documentação Técnica | Projeto DevOps | Junho 2026*

---

## Sumário

1. [Visão Geral](#1-visão-geral)
2. [Arquitetura](#2-arquitetura)
3. [Referência da API](#3-referência-da-api)
4. [Segurança](#4-segurança)
5. [Pipeline CI/CD](#5-pipeline-cicd)
6. [Execução Local](#6-execução-local)
7. [Estrutura de Arquivos](#7-estrutura-de-arquivos)
8. [Pendências e Melhorias](#8-pendências-e-melhorias)

---

## 1. Visão Geral

O **MarmitaTech Pro** é uma aplicação web fullstack para gerenciamento de pedidos de marmitas. Permite cadastrar produtos, registrar e acompanhar pedidos de clientes, exportar relatórios em CSV e exibir um painel Kanban para controle de status de entrega.

### 1.1 Tecnologias Utilizadas

| Camada | Tecnologia | Versão |
|---|---|---|
| Runtime | Node.js | 22 LTS |
| Framework Web | Express.js | 4.22.2 |
| Template Engine | EJS | 3.1.10 |
| Banco de Dados | MySQL | 8.0 |
| Driver DB | mysql2 | 3.22.3 |
| Containerização | Docker / Compose | — |
| CI/CD | GitHub Actions | — |
| Análise SAST | SonarQube | — |
| Scan de CVEs | Trivy | v0.36.0 |

---

## 2. Arquitetura

### 2.1 Serviços Docker

A aplicação é composta por dois serviços orquestrados via `docker-compose`:

```
┌─────────────────────────────────────────────┐
│              docker-compose                  │
│                                              │
│  ┌─────────────────────┐                    │
│  │  marmitatech-app    │  :3000 → :3000     │
│  │  Node.js 22-alpine  │                    │
│  │  depends_on: db ✓   │                    │
│  └──────────┬──────────┘                    │
│             │ mysql://db:3306               │
│  ┌──────────▼──────────┐                    │
│  │  marmitatech-db     │  :3307 → :3306     │
│  │  MySQL 8.0          │                    │
│  │  healthcheck: ✓     │                    │
│  └─────────────────────┘                    │
└─────────────────────────────────────────────┘
```

O serviço de banco possui healthcheck via `mysqladmin ping` com intervalo de 5 s, timeout de 5 s e até 10 tentativas. A aplicação só sobe após o banco estar saudável (`condition: service_healthy`).

### 2.2 Modelo de Dados

**Tabela `users`**

| Campo | Tipo | Descrição |
|---|---|---|
| id | INT PK AUTO_INCREMENT | Identificador único |
| username | VARCHAR(50) UNIQUE | Usuário de login |
| password | VARCHAR(255) | Hash no formato `salt:hash` (HMAC-SHA256) |

**Tabela `items`**

| Campo | Tipo | Descrição |
|---|---|---|
| id | INT PK AUTO_INCREMENT | Identificador único |
| name | VARCHAR(100) | Nome da marmita |
| price | DECIMAL(10,2) | Preço unitário |
| category | VARCHAR(50) | Categoria (opcional) |

**Tabela `orders`**

| Campo | Tipo | Descrição |
|---|---|---|
| id | INT PK AUTO_INCREMENT | Identificador único |
| customer_name | VARCHAR(100) | Nome do cliente |
| item_id | INT FK → items.id | Marmita pedida |
| quantity | INT | Quantidade (1–99) |
| total | DECIMAL(10,2) | Valor total calculado |
| status | VARCHAR(20) | Status do pedido |
| created_at | DATETIME | Data/hora de criação |

---

## 3. Referência da API

### 3.1 Autenticação e Usuários

| Método | Rota | Descrição | Resposta |
|---|---|---|---|
| `GET` | `/` | Redireciona para tela de login | HTML |
| `GET` | `/login` | Exibe formulário de login | HTML |
| `POST` | `/login` | Autentica usuário e redireciona | Redirect / JSON |
| `GET` | `/register` | Exibe formulário de cadastro | HTML |
| `POST` | `/register` | Cria novo usuário com senha hasheada | Redirect / JSON |

### 3.2 Marmitas (Items)

| Método | Rota | Descrição | Resposta |
|---|---|---|---|
| `GET` | `/items` | Lista todos os itens cadastrados | JSON Array |
| `POST` | `/items` | Cadastra nova marmita | JSON 201 |
| `PUT` | `/items/:id` | Atualiza marmita existente | JSON 200 |
| `DELETE` | `/items/:id` | Remove marmita por ID | JSON 200 |

**Body esperado — POST/PUT `/items`:**
```json
{
  "name": "Frango Grelhado",
  "price": 18.90,
  "category": "Proteína"
}
```

### 3.3 Pedidos (Orders)

| Método | Rota | Descrição | Resposta |
|---|---|---|---|
| `GET` | `/orders/new` | Formulário de novo pedido | HTML |
| `POST` | `/orders` | Cria pedido | JSON 201 / Redirect |
| `GET` | `/orders` | Lista todos os pedidos (JSON) | JSON Array |
| `PATCH` | `/orders/:id/status` | Atualiza status do pedido | JSON 200 |

**Body esperado — POST `/orders`:**
```json
{
  "customer_name": "João Silva",
  "item_id": 3,
  "quantity": 2
}
```

**Body esperado — PATCH `/orders/:id/status`:**
```json
{
  "status": "Em preparo"
}
```

**Status válidos:**

| Status | Significado |
|---|---|
| `Aberto` | Pedido recém-criado |
| `Em preparo` | Em preparo na cozinha |
| `Saiu para entrega` | A caminho do cliente |
| `Entregue` | Entregue com sucesso |
| `Cancelado` | Pedido cancelado |

### 3.4 Painel Administrativo

| Método | Rota | Descrição | Resposta |
|---|---|---|---|
| `GET` | `/dashboard` | Tabela de todos os pedidos | HTML |
| `GET` | `/admin` | Painel Kanban de pedidos | HTML |
| `GET` | `/admin/export` | Exporta pedidos em CSV (UTF-8 BOM) | CSV Download |

---

## 4. Segurança

### 4.1 Hash de Senhas

As senhas são armazenadas com **HMAC-SHA256** combinado a um salt aleatório de 16 bytes, no formato `salt:hash`. A comparação é feita recomputando o HMAC com o salt extraído — nunca comparando texto plano.

```
senha_armazenada = "<salt_hex>:<hmac_sha256(salt, password)>"
```

### 4.2 Validação de Entradas

Todas as rotas de escrita validam os dados antes de qualquer operação no banco:

| Campo | Regra |
|---|---|
| `username` | 3–50 caracteres, apenas `\w+` (letras, números, underscore) |
| `password` | Mínimo 6 caracteres |
| `name` (item) | Máximo 100 caracteres |
| `price` | Número positivo maior que zero |
| `category` | Máximo 50 caracteres (opcional) |
| `customer_name` | Máximo 100 caracteres |
| `quantity` | Inteiro de 1 a 99 |
| `id` (params) | Inteiro positivo — rejeitado caso contrário |

### 4.3 Proteção contra SQL Injection

Todas as queries utilizam **placeholders `?`** com o driver `mysql2`. Nenhum valor de entrada é interpolado diretamente na string SQL.

```js
// ✅ Correto — valor nunca interpola na query
connection.query('SELECT * FROM users WHERE username = ?', [username]);
```

### 4.4 Hardening do Container

- Cabeçalho `X-Powered-By` desabilitado (`app.disable('x-powered-by')`).
- Processo Node.js executa sob usuário sem privilégios (`appuser/appgroup`).
- Pacotes Alpine atualizados no build (`apk upgrade --no-cache`) para corrigir CVEs do SO.
- Dependências instaladas com `--omit=dev --ignore-scripts`.

---

## 5. Pipeline CI/CD

O arquivo `pipeline.yml` define um workflow do GitHub Actions com **duas trilhas** conforme a branch alvo.

### 5.1 Visão Geral do Fluxo

```
push → develop / PR → develop          push → staging
─────────────────────────────          ───────────────────────────────
estagio_build                          job_release_docker
    └── estagio_lint                       └── job_trivy_sonar
            └── job_sonar                          └── job_deploy_aws
```

### 5.2 Trilha de Desenvolvimento (`develop`)

| Job | Trigger | O que faz |
|---|---|---|
| `estagio_build` | push/PR → develop | Checkout, Node 22, `npm ci`, verificação de sintaxe (`node --check`) em todos os `.js` |
| `estagio_lint` | após build | Instala ESLint, gera `eslint.config.js` e executa `npm run lint` |
| `job_sonar` | após lint (apenas develop) | Cria `sonar-project.properties` e envia análise estática ao SonarQube |

### 5.3 Trilha de Staging (`staging`)

| Job | Depende de | O que faz |
|---|---|---|
| `job_release_docker` | — | Login Docker Hub, `docker build` e `docker push` com tag `sha` do commit |
| `job_trivy_sonar` | `job_release_docker` | Scan Trivy na imagem, converte para formato Sonar e envia ao SonarQube |
| `job_deploy_aws` | `job_trivy_sonar` | **TO DO** — SCP do compose + SSH para `docker compose pull/up` na AWS |

### 5.4 Segredos Necessários

| Secret | Utilização |
|---|---|
| `TOKEN_SONAR` | Autenticação no SonarQube (`https://devsecops.dcotech.com.br`) |
| `TOKEN_DOCKERHUB` | Login no Docker Hub como `jenrique138` |

---

## 6. Execução Local

### 6.1 Pré-requisitos

- Docker Engine 24+ e Docker Compose Plugin
- Git

### 6.2 Subindo o Ambiente

```bash
# Clonar o repositório
git clone <url-do-repositório>
cd <diretório>

# Subir os serviços (build + start)
docker compose up --build
```

A aplicação estará disponível em **http://localhost:3000**.
O MySQL estará acessível externamente na porta **3307**.

### 6.3 Credenciais Padrão

| Serviço | Usuário | Senha |
|---|---|---|
| Aplicação (admin) | `admin` | `admin123` |
| MySQL (root) | `root` | `root` |
| MySQL (app) | `user` | `password` |

> ⚠️ As credenciais acima são apenas para desenvolvimento local. Em produção, substitua por valores seguros via variáveis de ambiente ou secrets manager.

### 6.4 Variáveis de Ambiente

| Variável | Padrão | Descrição |
|---|---|---|
| `DB_HOST` | `db` | Hostname do MySQL |
| `DB_PORT` | `3306` | Porta do MySQL |
| `DB_USER` | `user` | Usuário do banco |
| `DB_PASS` | `password` | Senha do banco |
| `DB_NAME` | `marmitadb` | Nome do banco de dados |

---

## 7. Estrutura de Arquivos

```
.
├── index.js                  # Ponto de entrada — rotas, validações, conexão DB
├── package.json              # Manifesto Node.js com dependências e scripts
├── package-lock.json         # Lockfile para instalação determinística (npm ci)
├── init.sql                  # Script DDL/DML: tabelas e dados semente
├── Dockerfile                # Imagem Node 22-alpine, usuário sem privilégios
├── docker-compose.yml        # Orquestração app + db com healthcheck
├── .dockerignore             # Exclui node_modules e arquivos desnecessários
├── pipeline.yml              # Workflow GitHub Actions (CI + Staging)
└── views/
    ├── login.ejs             # Template de login
    ├── register.ejs          # Template de cadastro de usuário
    ├── dashboard.ejs         # Painel de pedidos em tabela
    ├── orders.ejs            # Formulário de criação de pedido
    └── admin.ejs             # Painel Kanban de pedidos
```

---

## 8. Pendências e Melhorias

### 8.1 Implementações TO DO

- **Deploy AWS** (`job_deploy_aws`) — atualmente imprime apenas mensagens placeholder; falta implementar as actions de SCP e SSH.
- **Commitar `eslint.config.js`** no repositório para eliminar o step de geração dinâmica no pipeline.
- **Fixar digest SHA** da imagem base `node:22-alpine` no Dockerfile para builds 100% reproduzíveis.

### 8.2 Melhorias de Segurança

- **Gerenciamento de sessão** — implementar `express-session` ou JWT; atualmente o login redireciona sem token de sessão persistente.
- **Rate limiting** nas rotas de autenticação para mitigar ataques de força bruta.
- **Connection pool** — substituir `mysql.createConnection` por `mysql.createPool` para maior resiliência.
- **Secrets em produção** — mover credenciais para AWS Secrets Manager ou HashiCorp Vault.

### 8.3 Qualidade e Observabilidade

- **Testes automatizados** — adicionar suíte com Jest + Supertest para cobertura no pipeline.
- **Logging estruturado** — substituir `console.error/log` por Winston ou Pino.
- **Métricas** — integrar Prometheus + Grafana para monitoramento em produção.

---

*Documentação gerada em Junho de 2026.*
