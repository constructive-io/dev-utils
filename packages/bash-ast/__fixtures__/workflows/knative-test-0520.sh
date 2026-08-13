kubectl patch configmap/config-domain \
  --namespace knative-serving \
  --type merge \
  --patch '{"data":{"example.com":""}}'
echo "Knative domain set to example.com for Kourier routing"
