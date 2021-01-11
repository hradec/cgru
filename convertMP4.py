#!/bin/python2 

import os,sys,glob

print "<br>"
files = []
if '@' in sys.argv[1]:
	path='/atomo/jobs'+sys.argv[1].split('@')[-1]
else:
	path='/atomo/jobs'+sys.argv[1]


allFiles=glob.glob(path+'/*')
for each in allFiles:
	if [ x for x in ['playblast','variance'] if x in each ]:
		if 'variance' in each:
			if os.path.exists(each.replace('variance','filtered')):
				each = each.replace('variance','filtered')
		files += [each]

if not files:
	for each in allFiles:
		if [ x for x in ['_filtered'] if x in each ]:
			files += [each]

if not files:
	for each in allFiles:
		files += [each]

files.sort()
#print files
#sys.exit(0)
cmd = ''
for file in files:
	pad = os.path.splitext(os.path.splitext(file)[0])[-1].replace('.','')
	jpg = '%s/.webplayer/%s.%s.jpg' % (path, os.path.splitext(os.path.splitext(file.replace('//','/').split('jobs/')[1].replace('/','_'))[0])[0], pad  )
	if not os.path.exists( jpg ):
		cmd += '/usr/bin/convert %s %s && ' % (file, jpg)

ext = os.path.splitext(files[0])[-1]
pad = os.path.splitext(os.path.splitext(files[0])[0])[-1].replace('.','')
fil = os.path.splitext(os.path.splitext(files[0].replace('//','/').split('jobs/')[1].replace('/','_'))[0])[0]
mp4 = os.path.basename( os.path.splitext(os.path.splitext(files[0])[0])[0] )
ver = files[0].strip('/').split('/')[-3]
mp4 = path+"/.webplayer/%s.mp4" % (sys.argv[1].split('@')[-1].strip('/').split('/')[0] +'_'+ mp4+'_'+ver)
cmd += ' rm -rf "'+mp4+'" && '
cmd += '''/atomo/pipeline/tools/scripts/ffmpeg_static  -y -start_number %s -r 24 -i '%s' -vcodec h264 -movflags +faststart  -vf 'scale=-2:min(1080\,if(mod(ih\,2)\,ih-1\,ih))' -r 24 %s 2>&1''' % ( pad, path+"/.webplayer/"+fil+"."+"%%%02dd" % len(pad)+".jpg", mp4 )
#cmd += '''/atomo/pipeline/tools/scripts/ffmpeg_static  -y -start_number %s -r 24 -i '%s' -c:v mpeg4 -b:v 800k  -profile:v baseline  -movflags +faststart -vf 'scale=-2:min(1080\,if(mod(ih\,2)\,ih-1\,ih))' -r 24 %s 2>&1''' % ( pad, path+"/.webplayer/"+fil+"."+"%%%02dd" % len(pad)+".jpg", mp4 )
log = ''
#if not os.path.exists(mp4):
log = cmd,"<br><br>", ''.join(os.popen(cmd).readlines()).replace("\n","<br>")

#print log, mp4
print mp4


#if '.jpg' in sys.argv[1]: # and not '.exr' in sys.argv[1]:
#    print '/atomo/jobs/%s.jpg' % '/'.join(sys.argv[1].split('/')[1:]).replace('.jpg','')
#
#else:
if 0:
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




