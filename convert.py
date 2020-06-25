#!/bin/python2 

import os,sys



#if '.jpg' in sys.argv[1]: # and not '.exr' in sys.argv[1]:
#    print '/atomo/jobs/%s.jpg' % '/'.join(sys.argv[1].split('/')[1:]).replace('.jpg','')
#
#else:
if 1:
    file     = '/'.join(sys.argv[1].split('/')[1:]).replace('.jpg','')
    webCache = '/atomo/jobs/%s/.webplayer' % os.path.dirname(file)

    tempFolder = "/dev/shm"
    if os.path.exists(webCache):
        tempFolder = webCache

#    temp='%s/%s' % (tempFolder, file.replace('/','_').replace(':','_').replace('exr','jpg').replace('EXR','jpg').replace('png','jpg').replace('PNG','jpg') )
    temp='%s/%s' % (tempFolder, file.replace('/','_').replace(':','_'))
    temp=os.path.splitext(temp)[0]+'.jpg'

    cmd='/usr/bin/convert "/atomo/jobs/%s" %s 2>&1 > /dev/shm/xxx' % (file,  temp) 

    f1 = os.path.getmtime( "/atomo/jobs/%s" % file)
    if os.path.exists(temp):
        f2 = os.path.getmtime(temp)
        if f1 > f2:
            lines = os.popen( cmd ).readlines()
    else:
        lines = os.popen( cmd ).readlines()

    lines = os.popen( "echo %s > /dev/shm/zzz" % cmd ).readlines()

    #print lines
    print temp




