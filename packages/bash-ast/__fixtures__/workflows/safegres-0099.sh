psql -v ON_ERROR_STOP=1 -d constructivedb \
  -f services/constructive-bootstrap/verify/platform-bootstrap-principal.sql
