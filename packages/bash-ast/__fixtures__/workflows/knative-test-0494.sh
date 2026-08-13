echo "Installing Knative Serving ${KNATIVE_VERSION} CRDs..."
kubectl apply -f "https://github.com/knative/serving/releases/download/knative-${KNATIVE_VERSION}/serving-crds.yaml"
