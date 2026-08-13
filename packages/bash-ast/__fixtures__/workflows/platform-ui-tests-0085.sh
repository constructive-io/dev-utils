fun www &
for i in $(seq 1 30); do
  if curl -sf http://localhost:5173/ > /dev/null 2>&1; then
    echo "Vite ready"
    break
  fi
  sleep 2
done
