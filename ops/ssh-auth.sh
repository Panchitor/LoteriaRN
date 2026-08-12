# Shared SSH authentication for Loteria operations.
# This file is sourced by the scripts in this directory.
LOTERIA_HOST="${LOTERIA_HOST:-root@149.50.139.29}"
LOTERIA_PORT="${LOTERIA_PORT:-5753}"
LOTERIA_SSH_KEY="${LOTERIA_SSH_KEY:-$HOME/.ssh/loteria_deploy_ed25519}"

remote_ssh() {
  if [ -f "$LOTERIA_SSH_KEY" ]; then
    ssh -i "$LOTERIA_SSH_KEY" -o BatchMode=yes -o StrictHostKeyChecking=accept-new -p "$LOTERIA_PORT" "$LOTERIA_HOST" "$@"
  elif [ -n "${SSHPASS:-}" ]; then
    sshpass -e ssh -o StrictHostKeyChecking=accept-new -p "$LOTERIA_PORT" "$LOTERIA_HOST" "$@"
  else
    echo "No SSH key found at $LOTERIA_SSH_KEY and SSHPASS is unset" >&2
    return 1
  fi
}

remote_scp() {
  if [ -f "$LOTERIA_SSH_KEY" ]; then
    scp -i "$LOTERIA_SSH_KEY" -o BatchMode=yes -o StrictHostKeyChecking=accept-new -P "$LOTERIA_PORT" "$@"
  elif [ -n "${SSHPASS:-}" ]; then
    sshpass -e scp -o StrictHostKeyChecking=accept-new -P "$LOTERIA_PORT" "$@"
  else
    echo "No SSH key found at $LOTERIA_SSH_KEY and SSHPASS is unset" >&2
    return 1
  fi
}
