#!/bin/bash -e

[[ $DATABASE_URL =~ ^postgres:\/\/([^:]+):([^@]+)@([^:]+):([^\/]+)\/(.+)$ ]]
export PG_USERNAME="${BASH_REMATCH[1]}"
export PG_PASSWORD="${BASH_REMATCH[2]}"
export PG_HOSTNAME="${BASH_REMATCH[3]}"
export PG_PORT="${BASH_REMATCH[4]}"
export PG_DATABASE="${BASH_REMATCH[5]}"

if [[ -z "$PG_USERNAME" || -z "$PG_PASSWORD" || -z "$PG_HOSTNAME" || -z "$PG_PORT" || -z "$PG_DATABASE" ]]; then
  echo "Invalid DATABASE_URL: $DATABASE_URL"
  echo "Expected format: postgres://username:password@hostname:port/database"
  exit 1
fi

exec /run.sh "$@"
