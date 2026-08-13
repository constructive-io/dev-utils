node -e "require('./compute/fun/cli/dist/commands/down').uninstallKnativeViaKubectl()"
echo "=== Post-teardown residue (every count must be 0) ==="
residue=0
check() {
  local label="$1"; local count="$2"
  echo "  ${label}: ${count}"
  if [ "${count}" -ne 0 ]; then residue=1; fi
}
check "knative CRDs"                "$(kubectl get crd -o name 2>/dev/null | grep -c knative || true)"
check "knative mutatingwebhooks"    "$(kubectl get mutatingwebhookconfiguration -o name 2>/dev/null | grep -c knative || true)"
check "knative validatingwebhooks"  "$(kubectl get validatingwebhookconfiguration -o name 2>/dev/null | grep -c knative || true)"
check "knative/kourier clusterroles" "$(kubectl get clusterrole -o name 2>/dev/null | grep -cE 'knative|kourier' || true)"
check "knative/kourier clusterrolebindings" "$(kubectl get clusterrolebinding -o name 2>/dev/null | grep -cE 'knative|kourier' || true)"
# Anchor to the two infra namespaces uninstallKnativeViaKubectl removes;
# a loose `knative` substring also matches E2E tenant namespaces (e.g.
# knative-e2e-*) that this step deliberately does not tear down.
check "knative/kourier namespaces"  "$(kubectl get ns -o name 2>/dev/null | grep -cE '^namespace/(knative-serving|kourier-system)$' || true)"
if [ "${residue}" -ne 0 ]; then
  echo "Teardown left Knative/Kourier resources behind — see counts above." >&2
  kubectl get crd 2>/dev/null | grep knative || true
  kubectl get ns 2>/dev/null | grep -E 'knative|kourier' || true
  exit 1
fi
echo "Cluster returned to base — no Knative/Kourier residue."
