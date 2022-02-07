#!/bin/bash

prefix=$PWD/faac

echo  $(ls -d faac-* | grep -v tar)
cd $(ls -d faac-* | grep -v tar)

export LDFLAGS="$LDFLAGS -B/usr/lib/gold-ld/"

if [ ! -z "$1" ]; then
   ./configure --help
   exit
else
   ./configure --prefix=$prefix --enable-shared
   python ../patch_faac.py
   make $@ && make install  $@
fi
