body=$(mktemp)
cat safegres-reports/summary.md > "$body"
printf '\n<!-- safegres-audit -->\n' >> "$body"
existing=$(gh api "repos/${{ github.repository }}/issues/$PR/comments" --paginate \
  -q '.[] | select(.body | contains("<!-- safegres-audit -->")) | .id' | head -1)
if [ -n "$existing" ]; then
  gh api -X PATCH "repos/${{ github.repository }}/issues/comments/$existing" -F body=@"$body"
else
  gh api -X POST "repos/${{ github.repository }}/issues/$PR/comments" -F body=@"$body"
fi
