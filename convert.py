#!/bin/python2 

import os,sys



file='/'.join(sys.argv[1].split('/')[1:]).replace('.jpg','')
temp='tmp/%s' % file.replace('/','_').replace(':','_').replace('exr','jpg').replace('EXR','jpg')

cmd='mkdir -p tmp ; /usr/sbin/convert /atomo/jobs/%s %s 2>&1 ' % (file,  temp) 

lines = os.popen( cmd ).readlines()

print temp




