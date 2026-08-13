set -euo pipefail
content=$(git ls-tree -r HEAD "${{ matrix.spec.dir }}" | sha256sum | cut -c1-64)
platform=$(git rev-parse 'HEAD:compute')
tag=$(printf '%s\n%s\n' "$content" "$platform" | sha256sum | cut -c1-16)
image="${REGISTRY}/${ORG}/${{ matrix.spec.image }}"
ref="${image}:${tag}"
echo "ref=$ref" >> "$GITHUB_OUTPUT"
# `latest` moves only on the default branch; the content tag is the
# immutable identity a deployment pins.
if [ "$GITHUB_REF" = 'refs/heads/main' ]; then
  printf 'tags=%s,%s:latest\n' "$ref" "$image" >> "$GITHUB_OUTPUT"
else
  printf 'tags=%s\n' "$ref" >> "$GITHUB_OUTPUT"
fi
if [ "$FORCE" != "true" ] && docker manifest inspect "$ref" >/dev/null 2>&1; then
  echo "published=true" >> "$GITHUB_OUTPUT"
  echo "::notice::$ref is already published — nothing to build."
else
  echo "published=false" >> "$GITHUB_OUTPUT"
fi
