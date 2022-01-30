#!/bin/bash

CD=$(dirname $(readlink -f $BASH_SOURCE))
cd $CD

docker run --rm --name cgru-build \
	-v $CD:/src \
	--entrypoint '' \
hradec/pipevfx_build:fedora35 bash -c 'cd /src ; ./build-hradec.sh --depend ; ./build-hradec.sh --afanasy'
