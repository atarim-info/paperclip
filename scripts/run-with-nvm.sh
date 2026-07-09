#!/usr/bin/env bash
# This script ensures that the correct Node.js version (LTS) is used via nvm.
# It is used by Paperclip's package.json scripts.

if [ -s "$HOME/.nvm/nvm.sh" ]; then
  source "$HOME/.nvm/nvm.sh"
  nvm use --lts > /dev/null
fi

exec "$@"
