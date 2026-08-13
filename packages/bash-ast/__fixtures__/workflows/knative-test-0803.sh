kubectl get pods -A -o wide || true
kubectl get ciliumclusterwidenetworkpolicies -o yaml || true
kubectl get ns --show-labels || true
kubectl -n kube-system logs ds/cilium --tail=100 || true
