helm repo add traefik https://traefik.github.io/charts
helm repo update
helm install traefik traefik/traefik \
  --namespace traefik --create-namespace \
  --version "${TRAEFIK_CHART_VERSION}" \
  --set service.type=ClusterIP \
  --set providers.kubernetesCRD.allowCrossNamespace=true \
  --set providers.kubernetesIngress.enabled=false \
  --wait --timeout 5m
kubectl get pods -n traefik
