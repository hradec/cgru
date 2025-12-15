/* ''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''' *\
 *        .NN.        _____ _____ _____  _    _                 This file is part of CGRU
 *        hMMh       / ____/ ____|  __ \| |  | |       - The Free And Open Source CG Tools Pack.
 *       sMMMMs     | |   | |  __| |__) | |  | |  CGRU is licensed under the terms of LGPLv3, see files
 * <yMMMMMMMMMMMMMMy> |   | | |_ |  _  /| |  | |    COPYING and COPYING.lesser inside of this folder.
 *   `+mMMMMMMMMNo` | |___| |__| | | \ \| |__| |          Project-Homepage: http://cgru.info
 *     :MMMMMMMM:    \_____\_____|_|  \_\\____/        Sourcecode: https://github.com/CGRU/cgru
 *     dMMMdmMMMd     A   F   A   N   A   S   Y
 *    -Mmo.  -omM:                                           Copyright © by The CGRU team
 *    '          '
\* ....................................................................................................... */

/*
	httpget.cpp - get delivered simple webserver for static assets, like html, js and css files
*/

#include "httpget.hpp"

#include <cctype>

#include "../include/afanasy.h"

#include "../libafanasy/environment.h"
#include "../libafanasy/msg.h"

#include "afcommon.h"

#define AFOUTPUT
#undef AFOUTPUT
#include "../include/macrooutput.h"
#include "../libafanasy/logger.h"
/*
This can be done only in std++11 stantard.
For now can't drop gcc < 4.8 support for now.
std::vector<char *> HttpGet::http_get_blacklist_files = {
	"..",		// do not allow escaping the document root of the webserver
	"htdigest", // do not allow access to the .htdigest file
	"htaccess", // do not allow access to the .htaccess file
	".json"		// do not allow access to any json file
};
*/
static const int http_get_blacklist_files_len = 4;
static const char * http_get_blacklist_files[http_get_blacklist_files_len] = {
	"..",		// do not allow escaping the document root of the webserver
	"htdigest", // do not allow access to the .htdigest file
	"htaccess", // do not allow access to the .htaccess file
	".json"		// do not allow access to any json file
};

static int hexCharToInt(char c)
{
	if ((c >= '0') && (c <= '9'))
		return c - '0';
	c = static_cast<char>(std::tolower(static_cast<unsigned char>(c)));
	if ((c >= 'a') && (c <= 'f'))
		return 10 + (c - 'a');
	return -1;
}

static std::string urlDecode(const std::string &i_value)
{
	std::string result;
	result.reserve(i_value.size());

	for (size_t i = 0; i < i_value.size(); i++)
	{
		char c = i_value[i];
		if (c == '%' && (i + 2 < i_value.size()))
		{
			int hi = hexCharToInt(i_value[i+1]);
			int lo = hexCharToInt(i_value[i+2]);
			if ((hi >= 0) && (lo >= 0))
			{
				result.push_back(static_cast<char>((hi << 4) | lo));
				i += 2;
				continue;
			}
		}
		else if (c == '+')
		{
			result.push_back(' ');
			continue;
		}

		result.push_back(c);
	}

	return result;
}

static void normalizeLeadingSlash(std::string &io_path)
{
	if (io_path.empty())
		return;

	if ((io_path[0] != '/') && (io_path[0] != '\\'))
		return;

	size_t pos = 0;
	while ((pos < io_path.size()) && ((io_path[pos] == '/') || (io_path[pos] == '\\')))
		pos++;

	if (pos > 1)
	{
		io_path.erase(0, pos - 1);
		if (io_path.empty())
			io_path = "/";
		else
			io_path[0] = '/';
	}
	else if (io_path[0] == '\\')
		io_path[0] = '/';
}

static bool isProjectsRootAllowed(const std::string &i_path)
{
	if (false == af::pathIsAbsolute(i_path))
		return false;

	std::string normalized = i_path;
	normalizeLeadingSlash(normalized);
	af::pathFilter(normalized);

	const std::vector<std::string> &roots = af::Environment::getProjectsRoot();
	for (size_t r = 0; r < roots.size(); r++)
	{
		if (roots[r].empty())
			continue;

		std::string root = roots[r];
		af::pathFilter(root);
		if (root.empty())
			continue;

		std::string compare_root = root;
		if ((compare_root.back() != '/') && (compare_root.back() != '\\'))
			compare_root += '/';

		if (normalized.compare(0, root.size(), root) == 0)
		{
			if (normalized.size() == root.size())
				return true;
			char next = normalized[root.size()];
			if ((next == '/') || (next == '\\'))
				return true;
		}
		if (normalized.compare(0, compare_root.size(), compare_root) == 0)
			return true;
	}

	return false;
}

af::Msg *HttpGet::process(const af::Msg *i_msg)
{
	af::Msg *o_msg = new af::Msg();

	const std::string file_name = HttpGet::getFileNameFromInMsg(i_msg);
	const std::string mimeType = HttpGet::getMimeTypeFromFileName(file_name);

	// ### copy the file with proper http header to the output
	int file_size;
	char *file_data = NULL;
	if (file_name.size())
	{
		std::string error;
		file_data = af::fileRead(file_name, &file_size, -1, &error);
	}

	if (file_data)
	{
		std::string httpHeader = af::getHttpHeader(file_size, mimeType, "200 OK");

		// combine http header with file content into msg_data
		int msg_data_len = httpHeader.length() + file_size;
		char *msg_data = new char[msg_data_len];
		memcpy(msg_data, httpHeader.c_str(), httpHeader.length());
		memcpy(msg_data + httpHeader.length(), file_data, file_size);

		o_msg->setData(msg_data_len, msg_data, af::Msg::THTTPGET);

		delete[] file_data;
		delete[] msg_data;
	}
	else
	{
		std::string outputText404 = HttpGet::get404Content(file_name);
		std::string output404 = af::getHttpHeader(outputText404.length(), mimeType, "404 Not Found");
		output404 += outputText404;
		o_msg->setData(output404.size(), output404.c_str(), af::Msg::THTTPGET);
	}

	return o_msg;
}

std::string HttpGet::getFileNameFromInMsg(const af::Msg *i_msg)
{
	std::string file_name;

	static const char tasks_file[] = "@TMP@";
	static const int tasks_file_len = strlen(tasks_file);
	static const char project_file[] = "@PROJECT@";
	static const int project_file_len = strlen(project_file);

	char *get = i_msg->data();
	int get_len = i_msg->dataLen();
	//::write( 1, get, get_len);
	int get_start = 4; // skipping "GET "
	int get_finish = get_start;
	while (get[++get_finish] != ' ')
		;
	while (get[get_start] == '/')
		get_start++;
	while (get[get_start] == '\\')
		get_start++;

	if (get_finish - get_start > 1)
	{
		file_name = std::string(get + get_start, get_finish - get_start);
		if (false == HttpGet::getValidateFileName(file_name))
		{
			AFCommon::QueueLogError("GET: Invalid file name from "
									+ i_msg->getAddress().v_generateInfoString() + "\n" + file_name);
			file_name.clear();
		}
		else if (file_name.find(tasks_file) == 0)
		{
			get_start += tasks_file_len;
			file_name = std::string(get + get_start, get_finish - get_start);
			if (file_name.find(af::Environment::getStoreFolder()) != 0)
			{
				AFCommon::QueueLogError("GET: Invalid @TMP@ folder from "
										+ i_msg->getAddress().v_generateInfoString() + "\n" + file_name);
				file_name.clear();
			}
			// printf("GET TMP FILE: %s\n", file_name.c_str());
		}
		else if (file_name.find(project_file) == 0)
		{
			std::string encoded = file_name.substr(project_file_len);
			encoded = urlDecode(encoded);
			normalizeLeadingSlash(encoded);
			if (encoded.empty())
			{
				AFCommon::QueueLogError("GET: Empty @PROJECT@ path from "
					+ i_msg->getAddress().v_generateInfoString());
				file_name.clear();
			}
			else if (false == af::pathIsAbsolute(encoded))
			{
				AFCommon::QueueLogError("GET: Invalid @PROJECT@ path (not absolute): "
					+ encoded);
				file_name.clear();
			}
			else if (false == isProjectsRootAllowed(encoded))
			{
				AFCommon::QueueLogError("GET: Access to '" + encoded +
					"' denied, not within projects_root.");
				file_name.clear();
			}
			else
			{
				af::pathFilter(encoded);
				file_name = encoded;
			}
		}
		else
		{
			// Add a directory index
			if (file_name[file_name.size()-1] == '/')
				file_name += af::Environment::getHTTPDirecoryIndex();
			else if (file_name.find('.') == std::string::npos)
				file_name = file_name + AFGENERAL::PATH_SEPARATOR + af::Environment::getHTTPDirecoryIndex();

			// Convert relative file name to absolute from serving directory
			file_name = af::Environment::getHTTPServeDir() + AFGENERAL::PATH_SEPARATOR + file_name;
		}
	}
	else
	{
		file_name = af::Environment::getHTTPServeDir() + af::Environment::getHTTPSiteIndex();
	}
	return file_name;
}

std::string HttpGet::getMimeTypeFromFileName(const std::string &filename)
{
	const std::string extension = filename.substr(filename.find_last_of(".") + 1);
	if (extension == "css") return "text/css";
	if (extension == "js") return "text/javascript";
	if (extension == "png") return "image/png";
	if (extension == "jpeg" || extension == "jpg") return "image/jpeg";
	if (extension == "gif") return "image/gif";
	if (extension == "htm" || extension == "html") return "text/html; charset=UTF-8";
	if (extension == "obj" || extension == "mtl") return "text/plain";
	if (extension == "exr") return "image/exr";
	if (extension == "tif" || extension == "tiff") return "image/tiff";
	if (extension == "bmp") return "image/bmp";

	return "application/octet-stream";
}

bool HttpGet::getValidateFileName(const std::string &i_name)
{
	// do not serve files, which match an entry on the blacklist
	//for (int i = 0; i < http_get_blacklist_files.size(); i++)
	for (int i = 0; i < http_get_blacklist_files_len; i++)
		if (i_name.find(http_get_blacklist_files[i]) != -1) return false;

	return true;
}

std::string HttpGet::get404Content(const std::string &filename)
{
	return std::string("<!DOCTYPE html><html><head><meta charset=\"UTF-8\"><title>AFANASY 404</title>")
		   + "<link type=\"text/css\" rel=\"stylesheet\" href=\"lib/styles.css\">"
		   + "<link type=\"text/css\" rel=\"stylesheet\" href=\"afanasy/browser/style.css\">"
		   + "</head><body id=\"afbody\" style=\"position: absolute; top: 50%;"
		   + "transform: translateY(-50%); text-align: center; width: 100%\">"
		   + "<span style=\"font-size: 30px;\">Arghh, page not found!</span><br>"
		   + "<span style=\"font-size: 100px; font-weight: bold;\">¯\\_(ツ)_/¯<br>404 Error</span><br>"
		   + "<span style=\"font-size: 20px;\">The requested file (" + filename
		   + ") could not be found on the server.</span><br>"
		   + "<span style=\"font-size: 15px;\">Contact the <a href=\"http://forum.cgru.info/\">forum</a>, "
		   + "if you think this is an error.</span></body></html>";
}
