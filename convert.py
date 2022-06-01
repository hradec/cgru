#!/bin/python2

import os,sys



#if '.jpg' in sys.argv[1]: # and not '.exr' in sys.argv[1]:
#    print '/atomo/jobs/%s.jpg' % '/'.join(sys.argv[1].split('/')[1:]).replace('.jpg','')
#
#else:
if 1:
    file     = '/'.join(sys.argv[1].split('/')[1:]).replace('.jpg','')
    webCache = '/atomo/jobs/%s/.webplayer' % os.path.dirname(file)


    # convert filtered instead of variance
    file_original = file
    if 'variance' in file:
       file_original = file.replace('variance','filtered')
       if not os.path.exists( "/atomo/jobs/%s" % file_original ):
           file_original = file
    file_original_size = os.path.getsize("/atomo/jobs/%s" % file_original)

    tempFolder = "/dev/shm"
    if os.path.exists(webCache):
        tempFolder = webCache

#    temp='%s/%s' % (tempFolder, file.replace('/','_').replace(':','_').replace('exr','jpg').replace('EXR','jpg').replace('png','jpg').replace('PNG','jpg') )
    temp='%s/%s' % (tempFolder, file.replace('/','_').replace(':','_'))
    temp=os.path.splitext(temp)[0]+'.jpg'
    tempSize=os.path.splitext(temp)[0]+'.size'

    cmd='/usr/bin/convert "/atomo/jobs/%s" %s 2>&1 > /dev/shm/xxx' % (file_original,  temp)

    convert = False
    f1 = os.path.getmtime( "/atomo/jobs/%s" % file)
    if os.path.exists(temp):
        f2 = os.path.getmtime(temp)
        if f1 > f2:
            convert=True
        else:
          if os.path.exists(tempSize):
            f = open(tempSize, 'r')
            size = ''.join(f.readlines())
            f.close()
            if int(size) != file_original_size:
               convert=True
          else:
            convert=True
    else:
        convert=True

    if convert:
        lines = os.popen( cmd ).readlines()
        f = open(tempSize, 'w')
        f.write(str(file_original_size))
        f.close()
        lines = os.popen( "echo %s > /dev/shm/zzz" % cmd ).readlines()

    #print lines
    print temp
