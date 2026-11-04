#!/usr/bin/env bash
# Starts the bundled MongoDB 7 server used by this workspace.
# Usage: ./start-db.sh   (leave it running in its own terminal)
set -e
mkdir -p /home/user/backend/.mongodata
exec /home/user/.cache/mongodb/bin/mongod \
  --dbpath /home/user/backend/.mongodata \
  --port 27017 \
  --bind_ip 127.0.0.1
