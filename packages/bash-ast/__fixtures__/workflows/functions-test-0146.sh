pgpm admin-users bootstrap --yes
# The stack grants CONNECT to app_user/app_admin, so a database it
# deploys into needs them to exist as well as the platform roles.
pgpm admin-users add --test --yes
