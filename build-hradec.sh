#!/bin/bash

export DISTRIBUTIVE_VERSION=2.3.1

#export PATH=/atomo/pipeline/libs/linux/x86_64/gcc-4.1.2/qt/4.8.4/bin/:$PATH
#export GCC=4.1.2
#export CXX="/atomo/pipeline/libs/linux/x86_64/gcc-$GCC/gcc/bin/g++"
#export CC="/atomo/pipeline/libs/linux/x86_64/gcc-$GCC/gcc/bin/gcc"
#export LDFLAGS="-Wl,-rpath /atomo/pipeline/libs/linux/x86_64/gcc-$GCC/gcc/lib64  -lrt"
CD=$(dirname $BASH_SOURCE)

if [ "$1" == "" ] ; then
    echo -e "\n\n Builds afanasy\n"
    echo -e "use '$(basename $0) --depend' to build dependencies"
    echo -e "use '$(basename $0) --afanasy' to build afanasy"
    echo -e "\n\n"
else
    # this is some basic setup for pipeVFX
    # as we keep the config files unique for all cgru versions
    rm -rf $CD/rules_root
    rm -rf $CD/config.json
    rm -rf $CD/afanasy/farm.json
    rm -rf $CD/afanasy/config.json
    ln -s /atomo/apps/linux/x86_64/cgru/.config/config.json  $CD/config.json
    ln -s /atomo/apps/linux/x86_64/cgru/.config/farm.json    $CD/afanasy/farm.json
    ln -s farm.json $CD/afanasy/config.json
    ln -s /atomo/jobs $CD/rules_root



    if [ "$(echo $1 | grep '\-d')" != "" ] ; then
        cd $CD/utilities/
        ./get.sh
        CMAKE_C_COMPILER=$CC  CMAKE_CXX_COMPILER=$CXX  ./build.sh -j 8
    fi
    if [ "$(echo $1 | grep '\-a')" != "" ] ; then
        cd $CD/afanasy/src/project.cmake/
        rm -rf ./CMakeCache.txt
        CMAKE_C_COMPILER=$CC  CMAKE_CXX_COMPILER=$CXX ./build.sh --nosql --nogui -j 8
    fi
fi
