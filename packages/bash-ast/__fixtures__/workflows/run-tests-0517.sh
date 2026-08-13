pgpm admin-users bootstrap --yes
psql -c "DO \$\$ BEGIN CREATE ROLE app_admin NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END \$\$"
