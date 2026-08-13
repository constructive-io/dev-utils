# The Gateway field is not always populated on the IPAM config
# (docker only records it once something asks); fall back to the
# .1 address of the network's IPv4 subnet. An empty value would
# silently describe.skip the static-site suite, so fail loud.
KIND_HOST_IP=$(docker network inspect kind \
  -f '{{range .IPAM.Config}}{{.Gateway}} {{end}}' | tr ' ' '\n' | grep -v ':' | grep -m1 . || true)
if [ -z "${KIND_HOST_IP}" ]; then
  SUBNET=$(docker network inspect kind \
    -f '{{range .IPAM.Config}}{{.Subnet}} {{end}}' | tr ' ' '\n' | grep -v ':' | grep -m1 .)
  KIND_HOST_IP=$(echo "${SUBNET}" | sed -E 's#\.[0-9]+/[0-9]+$#.1#')
fi
if [ -z "${KIND_HOST_IP}" ]; then
  echo "Failed to resolve Kind host IP" >&2
  exit 1
fi
echo "KIND_HOST_IP=${KIND_HOST_IP}" >> "$GITHUB_ENV"
echo "Kind host IP: ${KIND_HOST_IP}"
