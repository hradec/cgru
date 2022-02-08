#!/bin/bash

prefix=$PWD/faac

cd $(ls -1drt faac* | grep -v tar | tail -1)

export LDFLAGS="$LDFLAGS -B/usr/lib/gold-ld/"

# if [ ! -z "$1" ]; then
#    ./configure --help
#    exit
# else
   ./configure --prefix=$prefix --enable-shared
   python ../patch_faac.py
   make $@ && make install  $@
# fi
