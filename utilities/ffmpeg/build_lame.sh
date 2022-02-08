#!/bin/bash

prefix=$PWD/lame

cd $(ls -1drt lame* | grep -v tar | tail -1)

export LDFLAGS="$LDFLAGS -B/usr/lib/gold-ld/"

# if [ ! -z "$1" ]; then
#    ./configure --help
#    exit
# else
   ./configure --prefix=$prefix --enable-shared=
   make  $@ && make install $@
# fi
