echo "Waiting for Kourier gateway pods..."
kubectl wait --for=condition=Ready pods -l app=3scale-kourier-gateway -n kourier-system --timeout=120s || true
kubectl port-forward -n kourier-system svc/kourier 8080:80 &
sleep 2
echo "Kourier gateway forwarded to localhost:8080"
