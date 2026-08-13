# The runner itself is a variable in this experiment, so record it
# next to the numbers.
{
  echo "runner_name=$RUNNER_NAME"
  echo "nproc=$(nproc)"
  echo "mem_total_kb=$(awk '/MemTotal/{print $2}' /proc/meminfo)"
  grep -m1 'model name' /proc/cpuinfo
  echo "postgres_image_digest=$(docker inspect --format '{{index .RepoDigests 0}}' ghcr.io/constructive-io/docker/postgres-plus:18 2>/dev/null || echo unknown)"
} | tee runner-info.txt
