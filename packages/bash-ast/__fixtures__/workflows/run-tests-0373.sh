docker exec ${{ job.services.pg_db.id }} psql -U postgres -c "ALTER SYSTEM SET max_locks_per_transaction = 256"
docker restart ${{ job.services.pg_db.id }}
timeout 60 bash -c 'until docker exec ${{ job.services.pg_db.id }} pg_isready -U postgres; do sleep 1; done'
