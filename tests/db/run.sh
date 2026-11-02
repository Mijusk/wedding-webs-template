#!/usr/bin/env bash
# Ejecuta las pruebas de base de datos. Necesita la base local con migraciones y semillas:
#   supabase start && supabase db reset
#   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres tests/db/run.sh
set -uo pipefail
DB="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
cd "$(dirname "$0")"
fallos=0
for f in [0-9]*.sql; do
  echo "── $f"
  if ! out=$(psql "$DB" -X -q -v ON_ERROR_STOP=1 -f "$f" 2>&1); then fallos=$((fallos + 1)); fi
  echo "$out" | sed -n 's/.*NOTICE:  \(.*\)/  \1/p; s/.*ERROR:  \(.*\)/  ✗ \1/p'
done
if [[ $fallos -gt 0 ]]; then echo "✗ $fallos archivo(s) con fallos"; exit 1; fi
echo "✓ Todas las pruebas de base de datos pasan"
