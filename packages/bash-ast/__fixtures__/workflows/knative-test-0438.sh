psql --dbname postgres --set ON_ERROR_STOP=1 \
  --command "CREATE DATABASE ${KNATIVE_E2E_TEMPLATE_DB}"
cd application/app
pgpm deploy --fast --yes --database "${KNATIVE_E2E_TEMPLATE_DB}" --package app
