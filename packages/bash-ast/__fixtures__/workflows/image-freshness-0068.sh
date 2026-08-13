set -euo pipefail
BRANCH="chore/pin-constructive-$TAG"

# A rerun before the last PR merges would otherwise fail on push.
if git ls-remote --exit-code --heads origin "$BRANCH" >/dev/null 2>&1; then
  echo "Branch $BRANCH already exists — the bump to $TAG is already open."
  exit 0
fi

git config user.name "github-actions[bot]"
git config user.email "github-actions[bot]@users.noreply.github.com"
git checkout -b "$BRANCH"
git add compute/fun/env/src/images.ts

cat > /tmp/commit-msg.txt <<EOF
chore(k8s): pin the constructive image to $TAG

Resolved from the published \`latest\` tag by the image-freshness
workflow. This moves the opt-in pin only; the default stays \`:latest\`.
EOF
git commit -F /tmp/commit-msg.txt
git push origin "$BRANCH"

cat > /tmp/pr-body.md <<EOF
The digest \`GRAPHQL_IMAGE_PINNED\` points at is no longer the build \`latest\` resolves to.

| | tag | digest |
|---|---|---|
| was | \`$PREVIOUS_TAG\` | — |
| now | \`$TAG\` | \`$DIGEST\` |

This is the **opt-in pin** only — the default remains \`:latest\` with
\`imagePullPolicy: Always\`, so no cluster was running the stale build.
What was stale is the reference an operator gets when they ask for
reproducibility, and the value tests use when they need a build that
cannot move.

Opened by [image-freshness](${{ github.server_url }}/${{ github.repository }}/actions/workflows/image-freshness.yml).
EOF

gh pr create \
  --base main \
  --head "$BRANCH" \
  --title "chore(k8s): pin the constructive image to $TAG" \
  --body-file /tmp/pr-body.md
