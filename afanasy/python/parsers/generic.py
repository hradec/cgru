# -*- coding: utf-8 -*-

from parsers import parser

FRAME    = 'FRAME: '
PERCENT  = 'PROGRESS: '

class generic(parser.parser):
    """Simple generic parser
    """

    def __init__(self):
        parser.parser.__init__(self)

        self.str_warning =         ['[ PARSER WARNING ]']
        self.str_error =           ['[ PARSER ERROR ]']
        self.str_badresult =       ['[ PARSER BAD RESULT ]']
        self.str_finishedsuccess = ['[ PARSER FINISHED SUCCESS ]']

        self.firstframe = True

        self.str_expected_in_log = ['pipeLog:']
        self.expected = False
        self.fullLog = ''

    def do(self, i_args):
        data = i_args['data']

        needcalc = False

        if not data.strip():
            return None

        self.fullLog += data

        for string in self.str_error:
            if string in data:
                self.error = True

        if data.rfind(FRAME) > -1:
            if self.firstframe:
                self.firstframe = False
            else:
                self.frame += 1
                needcalc = True

        percent_pos = data.rfind(PERCENT)
        if percent_pos > -1:
            percent_pos += len(PERCENT)
            ppos = data.find('%', percent_pos)
            if ppos > -1:
                needcalc = True
                self.percentframe = int(data[percent_pos:ppos])

        if needcalc:
            self.calculate()

        for expected in self.str_expected_in_log:
            if expected in data:
                self.expected = True

        for l in data.split('\n'):
            if '@IMAGE@' in l: # Will be used in CGRU render scripts
                line = l.split('"')[1]
                self.appendFile(line.strip(), False)
                self.appendFile(line.strip(), True)

            print("===>"+l+"<===" );sys.stdout.flush()
        print("-----> self.error:", self.error,
                "| needcalc:", needcalc,
                '| self.percentframe:', self.percentframe,
                '| self.files:', self.files,
                '| len(self.fullLog):', len(self.fullLog.split('\n')),
        );sys.stdout.flush()

    def checkExitStatus(self, i_status):
        if self.error:
           return False

        if not self.expected:
            return False

        if len(self.fullLog.split('\n')) < 20:
            return False

        return True

    def returnAOVs4Thumbs(self, files, filter=['_variance'], notFilter=['filtered']):
        ret = files
        variance = []
        for nf in notFilter:
            for f in filter:
                variance += [ x for x in files if f in x and nf not in x ]
        if variance:
           ret = variance
        ret.sort()
        return ret

    def getFiles(self):
        """Missing DocString

        :return:
        """
        return self.files

    def getFilesOnTheFly(self):
        """Missing DocString

        :return:
        """
        ret = self.returnAOVs4Thumbs(self.files_onthefly, ['_variance','diffuse','specular'])
        if ret:
            for each in ret:
                del self.files_onthefly[ self.files_onthefly.index(each) ]
        else:
            ret = self.files_onthefly
            self.files_onthefly = []
        return ret
