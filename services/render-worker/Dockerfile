FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends chromium ca-certificates tini \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /worker
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY policy.mjs job.mjs ./
COPY chromium-policy.json /etc/chromium/policies/managed/folio.json
USER 1000:1000
ENV HOME=/tmp
ENTRYPOINT ["/usr/bin/tini", "--"]
# Idle, trusted process only. Controller installs network rules before docker exec.
CMD ["node", "-e", "setTimeout(()=>process.exit(0),60000)"]
