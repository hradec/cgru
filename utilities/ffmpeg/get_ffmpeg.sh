#!/usr/bin/env bash


if [ -e ffmpeg.tar.gz ] ; then
    tar xvf ffmpeg.tar.gz
else
    if [ -d ffmpeg ]; then
        cd ffmpeg
        git pull
        cd ..
    else
        git clone --depth=1 git://source.ffmpeg.org/ffmpeg.git ffmpeg
        tar czf ffmpeg.tar.gz ./ffmpeg
    fi
fi
