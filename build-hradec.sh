#!/bin/bash 

export DISTRIBUTIVE_VERSION=1.0.0

#export PATH=/atomo/pipeline/libs/linux/x86_64/gcc-4.1.2/qt/4.8.4/bin/:$PATH 
#export GCC=4.1.2 
#export CXX="/atomo/pipeline/libs/linux/x86_64/gcc-$GCC/gcc/bin/g++"  
#export CC="/atomo/pipeline/libs/linux/x86_64/gcc-$GCC/gcc/bin/gcc"  
#export LDFLAGS="-Wl,-rpath /atomo/pipeline/libs/linux/x86_64/gcc-$GCC/gcc/lib64  -lrt"  
CD=$(pwd)


rm $CD/config.json
rm $CD/afanasy/farm.json

ln -s /atomo/apps/linux/x86_64/cgru/.config/config.json  $CD/config.json
ln -s /atomo/apps/linux/x86_64/cgru/.config/farm.json    $CD/afanasy/farm.json
ln -s farm.json $CD/afanasy/config.json

cd $CD/utilities/
#CMAKE_C_COMPILER=$CC  CMAKE_CXX_COMPILER=$CXX  ./build.sh 
./get.sh
./build.sh 

cd $CD/afanasy/src/project.cmake/
#CMAKE_C_COMPILER=$CC  CMAKE_CXX_COMPILER=$CXX  ./build.sh 
./build.sh 

