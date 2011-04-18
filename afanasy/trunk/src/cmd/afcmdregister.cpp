#include "afcmd.h"

#include "cmd_arguments.h"

#include "cmd_text.h"
#include "cmd_test.h"
#include "cmd_confirm.h"
#include "cmd_regexp.h"
#include "cmd_invalid.h"

#include "cmd_string.h"
#include "cmd_path.h"
#include "cmd_network.h"
#include "cmd_numeric.h"
#include "cmd_passwd.h"
#include "cmd_parse.h"
#include "cmd_service.h"
#include "cmd_config.h"
#include "cmd_farm.h"
#include "cmd_statistics.h"

#include "cmd_database.h"

#include "cmd_talk.h"
#include "cmd_render.h"
#include "cmd_user.h"
#include "cmd_monitor.h"

#include "cmd_job.h"
#include "cmd_task.h"

void AfCmd::RegisterCommands()
{
   addCmd( new CmdVerbose);
   addCmd( new CmdProtocol);
   addCmd( new CmdServerName);
   addCmd( new CmdServerPort);
   addCmd( new CmdHelp);
   addCmd( new CmdFork);

   addCmd( new CmdText);
   addCmd( new CmdTest);
   addCmd( new CmdTextGenerate);
   addCmd( new CmdConfirm);
   addCmd( new CmdRegExp);
   addCmd( new CmdInvalid);

   addCmd( new CmdTalkList);

   addCmd( new CmdMonitorList);

   addCmd( new CmdRenderList);
   addCmd( new CmdRenderPriority);
   addCmd( new CmdRenderNimby);
   addCmd( new CmdRenderNIMBY);
   addCmd( new CmdRenderUser);
   addCmd( new CmdRenderFree);
   addCmd( new CmdRenderEject);
   addCmd( new CmdRenderExit);
   addCmd( new CmdRenderDelete);
   addCmd( new CmdRenderResoucesList);
   addCmd( new CmdRenderWOLSleep);
   addCmd( new CmdRenderWOLWake);

   addCmd( new CmdUserList);
   addCmd( new CmdUserJobsList);
   addCmd( new CmdUserAdd);
   addCmd( new CmdUserDelete);
   addCmd( new CmdUserPriority);
   addCmd( new CmdUserRunningTasksMaximum);
   addCmd( new CmdUserHostsMask);

   addCmd( new CmdJobsList);
   addCmd( new CmdJobsPause);
   addCmd( new CmdJobsStop);
   addCmd( new CmdJobsStart);
   addCmd( new CmdJobsRestart);
   addCmd( new CmdJobsDelete);
   addCmd( new CmdJobsWeight);
   addCmd( new CmdJobId);
   addCmd( new CmdJobLog);
   addCmd( new CmdJobProgress);
   addCmd( new CmdJobPriority);
   addCmd( new CmdJobRunningTasksMaximum);
   addCmd( new CmdJobHostsMask);
   addCmd( new CmdJob);

   addCmd( new CmdTaskOutput);

   addCmd( new CmdString);
   addCmd( new CmdPath);
   addCmd( new CmdNetwork);
   addCmd( new CmdNumeric);
   addCmd( new CmdPasswd);
   addCmd( new CmdParse);
   addCmd( new CmdSrvCapacity);
   addCmd( new CmdSrvHosts);

   addCmd( new CmdDBDrivers);
   addCmd( new CmdDBCheck);
   addCmd( new CmdDBResetUsers);
   addCmd( new CmdDBResetRenders);
   addCmd( new CmdDBResetJobs);
   addCmd( new CmdDBResetStat);
   addCmd( new CmdDBResetAll);
   addCmd( new CmdDBJobsList);
   addCmd( new CmdDBJobsClean);
   addCmd( new CmdDBSysJobDel);

   addCmd( new CmdConfig);
   addCmd( new CmdConfigLoad);

   addCmd( new CmdFarm);
   addCmd( new CmdFarmLoad);
   addCmd( new CmdFarmCheck);

   addCmd( new CmdStatistics);
}
