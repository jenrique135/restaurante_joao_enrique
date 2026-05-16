# Node 22 LTS (suporte ativo até Abril de 2027)
# Para builds reproduzíveis, fixe o digest:
#   docker pull node:22-alpine && docker inspect node:22-alpine --format '{{index .RepoDigests 0}}'
#   FROM node:22-alpine@sha256:<digest>
FROM node:22-alpine

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

# Verifica se a aplicação está respondendo a cada 30s
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/ || exit 1

CMD ["node", "index.js"]
