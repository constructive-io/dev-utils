set -euo pipefail
mkdir -p ~/.ollama-models
docker run -d --name ollama \
  -v ~/.ollama-models:/root/.ollama \
  -p 11434:11434 \
  ollama/ollama:0.32.9
for i in $(seq 1 30); do
  curl -sf http://localhost:11434/api/tags >/dev/null && break
  sleep 2
done
curl -sf http://localhost:11434/api/tags >/dev/null
if curl -sf http://localhost:11434/api/tags | grep -q '"nomic-embed-text'; then
  echo "model already cached"
else
  curl -sf http://localhost:11434/api/pull \
    -d '{"name":"nomic-embed-text"}' -o /tmp/pull.log
  grep -q '"status":"success"' /tmp/pull.log || { cat /tmp/pull.log; exit 1; }
fi
