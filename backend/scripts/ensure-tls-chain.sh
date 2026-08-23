#!/usr/bin/env bash
# ensure-tls-chain.sh — give nginx the chain.pem its generated config asks for.
#
# Why this exists:
#   `nself build` writes `ssl_trusted_certificate .../chain.pem` into every
#   generated vhost, but the certificate bundle it generates contains only
#   fullchain.pem and privkey.pem. nginx then refuses to start:
#     [emerg] cannot load certificate ".../chain.pem": BIO_new_file() failed
#   so a correctly followed self-host walkthrough ends with no reverse proxy at
#   all. Reproduced on a clean clone, 2026-08-24.
#
#   For a locally generated certificate the fullchain IS the chain, so copying it
#   is correct rather than merely expedient. Idempotent: it only writes a
#   chain.pem that is missing.
#
# CLI gap filed with nself: nself-ssl-chain-pem-missing.
set -euo pipefail

BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CERT_ROOT="$BACKEND_DIR/ssl/certificates"
[ -d "$CERT_ROOT" ] || exit 0

created=0
for dir in "$CERT_ROOT"/*/; do
  [ -f "${dir}fullchain.pem" ] || continue
  [ -f "${dir}chain.pem" ] && continue
  cp "${dir}fullchain.pem" "${dir}chain.pem"
  echo "[ensure-tls-chain] created ${dir}chain.pem (nginx config references it; nself build does not emit it)"
  created=$((created + 1))
done
[ "$created" -eq 0 ] || echo "[ensure-tls-chain] $created chain file(s) created."
