# variant -> "jit tuned work_mem". `tuned` mirrors what
# validate-introspection does (pgpm tune --yes), so `baseline` is the
# configuration the real CI job runs under.
# On a bench/** push there are no inputs, so fall back to the pair that
# answers the open question — does the runner's slow mode spill?
VARIANTS='${{ inputs.variants }}'
[ -z "$VARIANTS" ] && VARIANTS='baseline,work_mem'
REPEAT='${{ inputs.repeat }}'
[ -z "$REPEAT" ] && REPEAT=1

declare -A V=(
  [baseline]="on yes default"
  [work_mem]="on yes 256MB"
  [jit_off]="off yes default"
  [untuned]="on no default"
)
ITEMS=()
IFS=',' read -ra WANT <<< "$VARIANTS"
for v in "${WANT[@]}"; do
  v=$(echo "$v" | tr -d '[:space:]')
  [ -z "${V[$v]:-}" ] && { echo "::error::unknown variant $v"; exit 1; }
  read -r jit tuned wm <<< "${V[$v]}"
  for i in $(seq 1 "$REPEAT"); do
    ITEMS+=("{\"name\":\"$v-$i\",\"jit\":\"$jit\",\"tuned\":\"$tuned\",\"work_mem\":\"$wm\"}")
  done
done
printf 'matrix={"include":[%s]}\n' "$(IFS=,; echo "${ITEMS[*]}")" >> $GITHUB_OUTPUT
printf 'planned: %s\n' "${ITEMS[*]}"
