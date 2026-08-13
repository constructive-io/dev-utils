kubectl port-forward -n traefik svc/traefik 8090:80 &
sleep 2
echo "Traefik web entrypoint forwarded to localhost:8090"
