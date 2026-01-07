#!/bin/bash

CD=$(dirname $(readlink -f $BASH_SOURCE))
cd $CD

git clone git@github.com:hradec/cgru.git ./build/
cd ./build

git checkout devel-asesso
git branch

cp $CD/build-hradec.sh ./

docker run --rm -ti --name cgru-build \
	-v /etc/resolv.conf:/etc/resolv.conf \
	-v $CD/build:/src \
	--entrypoint '' \
hradec/pipevfx_build:fedora35 bash -c 'route -n ; dnf install bzip2 && cd /src && ./build-hradec.sh --afanasy' # ; ./build-hradec.sh --depend'
