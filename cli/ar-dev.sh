ORIGINAL_DIR=$(pwd)
BASEDIR=$(dirname $0)
cd $BASEDIR

if npm run --ignore-scripts build; then
    cd $ORIGINAL_DIR
    ./cli/dist/cli.js "$@"
else
    cd $ORIGINAL_DIR
    echo "✘ Failed to build CLI app"
fi
