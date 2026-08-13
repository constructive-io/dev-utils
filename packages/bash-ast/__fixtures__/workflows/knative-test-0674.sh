echo "=== Namespaces ==="
kubectl get ns || true
echo ""
echo "=== Knative Services ==="
kubectl get ksvc -A || true
echo ""
echo "=== Deployments ==="
kubectl get deployments -A || true
echo ""
echo "=== Ingresses ==="
kubectl get ingress -A || true
echo ""
echo "=== Secrets ==="
kubectl get secrets -A | grep -v default-token || true
echo ""
echo "=== Events (last 50) ==="
kubectl get events -A --sort-by='.lastTimestamp' | tail -50 || true
echo ""
echo "=== Pod status ==="
kubectl get pods -A || true
echo ""
echo "=== Logs of pods that are not Running ==="
kubectl get pods -A --no-headers 2>/dev/null \
  | awk '$4 != "Running" && $4 != "Completed" { print $1, $2 }' \
  | while read -r ns pod; do
      echo "--- $ns/$pod (current) ---"
      kubectl logs -n "$ns" "$pod" --all-containers --tail=100 || true
      echo "--- $ns/$pod (previous) ---"
      kubectl logs -n "$ns" "$pod" --all-containers --previous --tail=100 || true
    done
