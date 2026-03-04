#!/bin/bash

# capture SIGTERM and SIGINT for graceful shutdown
trap 'kill -TERM $PID' TERM INT

if [ -z "$RUN_LOCAL_DEV" ]; then
	node source/cli/Meadow-Integration-CLI-Run.js data-clone &
	PID=$!
else
	node --inspect="0.0.0.0:9229" source/cli/Meadow-Integration-CLI-Run.js data-clone &
	PID=$!
fi

wait $PID
trap - TERM INT
wait $PID
EXIT_STATUS=$?
echo "Service exited with status ${EXIT_STATUS}"
