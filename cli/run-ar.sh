#!/bin/bash

ORIGINAL_DIR=$(pwd)
BASEDIR=$(dirname $0)
cd $BASEDIR

if [ ! -d "./node_modules" ]; then
    echo "node_modules does not exist. Run npm install? (y/N)"
    read -p RUN_N
    if [ "$RUN_N" = "y" ]; then 
        npm install --ignore-scripts
    fi
fi

if [ ! -d "./dist" ]; then
    echo "dist does not exist. Would you like to build it?"
    read -p "Would you like to build it? (Y/n) > " RUN_D
    if [ "$RUN_D" != "n" ]; then 
        npm run --ignore-scripts build 1>/dev/null
    fi
fi

cd $ORIGINAL_DIR
./cli/dist/cli.js "$@"
