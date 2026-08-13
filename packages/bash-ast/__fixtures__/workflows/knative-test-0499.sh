echo "Installing Knative Serving ${KNATIVE_VERSION} core..."
kubectl apply -f "https://github.com/knative/serving/releases/download/knative-${KNATIVE_VERSION}/serving-core.yaml"
