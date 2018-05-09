#!/usr/bin/env bash
#
# Flattens contracts to build/flattened/
#

set -eu
set -o pipefail


if [[ $# > 0 && "$1" == "__file" ]]; then
    FLATTEN_LOG="$TARGET_SUBDIR/flatten.log"

    solidity_flattener \
        --solc-allow-paths "$(readlink -f "$BIN_DIR/contracts")" \
        --solc-paths "zeppelin-solidity=$NODE_MODULES/zeppelin-solidity" \
        --solc-paths "mixbytes-solidity=$NODE_MODULES/mixbytes-solidity" \
        --output "$TARGET_SUBDIR/$(basename "$2")" \
        "$2" \
        2>>"$FLATTEN_LOG" \
        || echo failed to flatten $2, see $FLATTEN_LOG

    exit 0
fi

export TARGET_SUBDIR='build/flattened'

export BIN_DIR="$(cd $(dirname $0) && pwd)"
cd "$BIN_DIR"


export NODE_MODULES="$(readlink -f "$BIN_DIR/node_modules")"

rm -rf "$TARGET_SUBDIR"
mkdir -p "$TARGET_SUBDIR"

find contracts/ -name \*.sol -print0 | xargs -0 -L 1 "$0" __file
