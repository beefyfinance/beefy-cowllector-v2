#!/bin/bash -e

# inject env vars in provisioning templates
sed -i "s/__DISCORD_HARVESTERS_ROLE_ID__/${DISCORD_HARVESTERS_ROLE_ID}/g" /etc/grafana/provisioning/alerting/discord_templates.yml
sed -i "s/__DISCORD_STRATEGISTS_ROLE_ID__/${DISCORD_STRATEGISTS_ROLE_ID}/g" /etc/grafana/provisioning/alerting/discord_templates.yml

# use a pointer to the environment variable because it may change name
DB_URL=${!COWLLECTOR_DB_URL_ENV_VAR}

[[ $DB_URL =~ ^postgres:\/\/([^:]+):([^@]+)@([^:]+):([^\/]+)\/(.+)$ ]]
export PG_USERNAME="${BASH_REMATCH[1]}"
export PG_PASSWORD="${BASH_REMATCH[2]}"
export PG_HOSTNAME="${BASH_REMATCH[3]}"
export PG_PORT="${BASH_REMATCH[4]}"
export PG_DATABASE="${BASH_REMATCH[5]}"

if [[ -z "$PG_USERNAME" || -z "$PG_PASSWORD" || -z "$PG_HOSTNAME" || -z "$PG_PORT" || -z "$PG_DATABASE" ]]; then
  echo "Invalid DATABASE_URL: $DB_URL"
  echo "Found looking at the content of '$COWLLECTOR_DB_URL_ENV_VAR'"
  echo "Expected format: postgres://username:password@hostname:port/database"
  exit 1
fi

exec /run.sh "$@"
