#!/usr/bin/env bash

libogg=$PWD/libogg
cd $(ls -1drt libogg* | grep -v tar | tail -1)

export LDFLAGS="-B/usr/lib/gold-ld/"
# if [ ! -z "$1" ]; then
#    ./configure --help
# else
   ./configure --prefix=$libogg --enable-shared=
   make $@ && make install $@
# fi

cd ..

libvorbis=$PWD/libvorbis
cd $(ls -1drt libvorbis-* | grep -v tar | tail -1)
export CFLAGS="-B/usr/lib/gold-ld/ -I$libogg/include"
export LDFLAGS="-B/usr/lib/gold-ld/ -L$libogg/lib -L$libogg/lib64"
# if [ ! -z "$1" ]; then
#    ./configure --help
# else
   ./configure --prefix=$libvorbis --enable-shared=
   make $@ && make install $@
# fi

cd ..

libtheora=$PWD/libtheora
cd $(ls -1drt libtheora-* | grep -v tar | tail -1)
export CFLAGS="-B/usr/lib/gold-ld/ -I$libogg/include"
export LDFLAGS="-B/usr/lib/gold-ld/ -L$libogg/lib -L$libogg/lib64"
# if [ ! -z "$1" ]; then
#    ./configure --help
# else
   ./configure --prefix=$libtheora --enable-shared=
   make $@ && make install $@
# fi
