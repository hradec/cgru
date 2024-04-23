#!/usr/bin/env bash

if [ -e x264.tar.gz ] ; then
        tar xvf x264.tar.gz
else
    if [ -d x264 ]; then
        cd x264
        git pull -v
        cd ..
    else
        git clone --depth=1 https://code.videolan.org/videolan/x264.git
        tar czf x264.tar.gz ./x264
  fi
fi
