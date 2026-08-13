set -euo pipefail
helm repo add cilium https://helm.cilium.io/
helm repo update
helm upgrade --install cilium cilium/cilium \
  --version "${CILIUM_VERSION}" \
  --namespace kube-system \
  --set ipam.mode=kubernetes \
  --set routingMode=native \
  --set ipv4NativeRoutingCIDR=10.244.0.0/16 \
  --set autoDirectNodeRoutes=true \
  --set bpf.masquerade=true \
  --set nodePort.enabled=true \
  --set image.pullPolicy=IfNotPresent \
  --set operator.replicas=1 \
  --wait --timeout 10m
kubectl -n kube-system rollout status ds/cilium --timeout=300s
kubectl get crd ciliumclusterwidenetworkpolicies.cilium.io
