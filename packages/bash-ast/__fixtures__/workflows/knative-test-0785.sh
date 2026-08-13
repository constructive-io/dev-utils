set -euo pipefail
kubectl apply -f compute/k8s/network/tenant-isolation.yaml
echo "=== Cluster-wide policies now in force ==="
kubectl get ciliumclusterwidenetworkpolicies
