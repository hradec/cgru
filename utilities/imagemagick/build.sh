#!/usr/bin/env bash

export MAKEFLAGS="-j 32"

im=$PWD/ImageMagick

exr=`dirname $PWD`/openexr

prefix=$PWD

if [ -d "$exr/include" ]; then
	export OPENEXR_CFLAGS="-I$exr/include/OpenEXR"
	export OPENEXR_LIBS="-L$exr/lib -L$exr/lib64 -lIlmImf -lz -lImath -lHalf -lIex -lIlmThread -lpthread"
fi

cd $im

configure="./configure"
configure="$configure --prefix=$prefix"
configure="$configure --with-openexr"
# configure="$configure --enable-hdri"
configure="$configure --disable-opencl"
configure="$configure --enable-shared="
#with-quantum-depth=32

make clean
$configure
make $@
make $@ install
cp -rf $CD/bin/* ../../../bin/
