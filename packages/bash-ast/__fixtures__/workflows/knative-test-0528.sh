echo "Waiting for Knative Serving pods to be ready..."
kubectl wait --for=condition=Ready pods --all -n knative-serving --timeout=180s || true
echo "Knative Serving pod status:"
kubectl get pods -n knative-serving
