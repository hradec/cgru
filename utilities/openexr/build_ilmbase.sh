#!/usr/bin/env bash

prefix=$PWD

export CPPFLAGS="-fPIC"

cd $(ls -1drt ilmbase* | grep -v tar | tail -1)


if [ ! -z $1 ] ; then
   ./configure -h; exit
fi

make clean

./configure --prefix=$prefix --exec-prefix=$prefix --enable-shared=

make $@

make install $@
