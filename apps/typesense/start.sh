#!/bin/sh
# Typesense only binds IPv4. Railway internal networking uses IPv6.
# Start Typesense on port 8109, then bridge IPv6:8108 → IPv4:8109 via socat.
/opt/typesense-server \
  --data-dir=/data \
  --api-key="${TYPESENSE_API_KEY}" \
  --enable-cors \
  --thread-pool-size=8 \
  --api-port=8109 &

# Wait for Typesense to be ready
until wget -qO- http://127.0.0.1:8109/health 2>/dev/null | grep -q '"ok":true'; do
  sleep 1
done

exec socat TCP6-LISTEN:8108,fork,reuseaddr TCP4:127.0.0.1:8109
