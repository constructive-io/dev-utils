echo "═══ Knative services ═══"
kubectl get ksvc -A -o wide || true
echo "═══ Knative revisions ═══"
kubectl get revisions -A -o wide || true
echo "═══ Pods ═══"
kubectl get pods -A -o wide || true
echo "═══ Recent events ═══"
kubectl get events -A --sort-by=.lastTimestamp | tail -150 || true
echo "═══ Knative service descriptions ═══"
for ns in $(kubectl get ksvc -A -o jsonpath='{range .items[*]}{.metadata.namespace}{"\n"}{end}' | sort -u); do
  kubectl describe ksvc -n "$ns" || true
done
echo "═══ compute-worker logs ═══"
kubectl logs -n constructive-functions deploy/compute-worker --tail=300 || true
echo "═══ DB-managed platform workloads ═══"
kubectl get all -n constructive-platform-default || true
kubectl logs -n constructive-platform-default deploy/graphql-public --tail=100 || true
kubectl logs -n constructive-platform-default deploy/graphql-private --tail=100 || true
