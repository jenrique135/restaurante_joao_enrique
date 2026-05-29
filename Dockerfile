# Node 22 LTS (suporte ativo até Abril de 2027)
# Para builds reproduzíveis, fixe o digest:
#   docker pull node:22-alpine && docker inspect node:22-alpine --format '{{index .RepoDigests 0}}'
#   FROM node:22-alpine@sha256:<digest>
FROM node:22-alpine

# Atualiza todos os pacotes do Alpine para corrigir CVEs do sistema operacional
RUN apk upgrade --no-cache

WORKDIR /app

# Copia manifesto e instala dependências antes do código-fonte
# para aproveitar o cache de camadas do Docker
COPY package*.json ./

RUN npm install --omit=dev --ignore-scripts

COPY index.js ./
COPY views ./views


EXPOSE 3000

# Usuário sem privilégios para execução do processo
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser


CMD ["node", "index.js"]
