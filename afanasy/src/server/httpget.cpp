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

#include <cstring>
#include <cctype>
#include <sstream>

#ifdef WINNT
#include <windows.h>
#else
#include <dirent.h>
#include <sys/stat.h>
#endif

#include "../include/afanasy.h"

#include "../libafanasy/environment.h"
#include "../libafanasy/msg.h"
#include "../libafanasy/name_af.h"

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

static bool isPathAllowedForListing(const std::string &i_path)
{
	if (isProjectsRootAllowed(i_path))
		return true;

	std::string store = af::Environment::getStoreFolder();
	if (store.empty())
		return false;

	std::string normalized = i_path;
	normalizeLeadingSlash(normalized);
	af::pathFilter(normalized);
	af::pathFilter(store);

	if (normalized.compare(0, store.size(), store) == 0)
	{
		if (normalized.size() == store.size())
			return true;
		char next = normalized[store.size()];
		if ((next == '/') || (next == '\\'))
			return true;
	}

	return false;
}

static std::string httpJsonResponse(const std::string &i_body, const std::string &i_status)
{
	std::string header = af::getHttpHeader(i_body.length(), "application/json; charset=UTF-8", i_status);
	return header + i_body;
}

static std::string httpHeader64(long long i_content_length, const std::string &i_mimeType, const std::string &i_status)
{
	long long content_length = i_content_length;
	if (content_length < 0)
		content_length = 0;

	int maxAge = 0;
	if ((i_mimeType == "text/css") || (i_mimeType == "text/javascript") || (i_mimeType.find("image/") != std::string::npos))
		maxAge = 60 * 60;

	return "HTTP/1.1 " + i_status + "\r\n"
		+ "Connection: close\r\n"
		+ "Content-Length: " + af::itos(content_length) + "\r\n"
		+ "Content-Type: " + i_mimeType + "\r\n"
		+ "Cache-Control: max-age=" + af::itos(maxAge) + "\r\n"
		+ "Server: afanasy/" + af::Environment::getVersionCGRU() + "\r\n"
		+ "\r\n";
}

static bool getRegularFileSize(const std::string &i_path, long long *o_size)
{
	if (o_size)
		*o_size = 0;

#ifdef WINNT
	WIN32_FILE_ATTRIBUTE_DATA fad;
	if (GetFileAttributesEx(i_path.c_str(), GetFileExInfoStandard, &fad) == 0)
		return false;
	if (fad.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY)
		return false;
	unsigned long long size = (static_cast<unsigned long long>(fad.nFileSizeHigh) << 32ULL) |
		static_cast<unsigned long long>(fad.nFileSizeLow);
	if (o_size)
		*o_size = static_cast<long long>(size);
	return true;
#else
	struct stat st;
	if (-1 == stat(i_path.c_str(), &st))
		return false;
	if (false == S_ISREG(st.st_mode))
		return false;
	if (o_size)
		*o_size = static_cast<long long>(st.st_size);
	return true;
#endif
}

static std::string injectHttpHeaderLine(const std::string &i_header, const std::string &i_line)
{
	size_t pos = i_header.rfind("\r\n\r\n");
	if (pos == std::string::npos)
		return i_header + i_line + "\r\n\r\n";

	std::string out = i_header;
	// Insert after the last header line terminator, but before the blank line.
	out.insert(pos + 2, i_line + "\r\n");
	return out;
}

static bool parseHttpRangeHeader(const af::Msg *i_msg, long long i_file_size, long long *o_start, long long *o_end)
{
	if (o_start)
		*o_start = 0;
	if (o_end)
		*o_end = 0;

	if ((i_msg == NULL) || (i_file_size <= 0))
		return false;

	const char *data = i_msg->data();
	const int dataLen = i_msg->dataLen();
	if ((data == NULL) || (dataLen <= 0))
		return false;

	std::string req(data, dataLen);
	std::string lower = req;
	for (size_t i = 0; i < lower.size(); i++)
		lower[i] = static_cast<char>(std::tolower(static_cast<unsigned char>(lower[i])));

	size_t pos = lower.find("\nrange:");
	if (pos == std::string::npos)
		pos = lower.find("\rrange:");
	if (pos == std::string::npos)
		pos = lower.find("range:");
	if (pos == std::string::npos)
		return false;

	size_t line_end = lower.find('\n', pos);
	if (line_end == std::string::npos)
		line_end = lower.size();

	std::string line = lower.substr(pos, line_end - pos);
	size_t bpos = line.find("bytes=");
	if (bpos == std::string::npos)
		return false;

	std::string spec = line.substr(bpos + 6);
	size_t comma = spec.find(',');
	if (comma != std::string::npos)
		spec = spec.substr(0, comma);

	// Strip spaces:
	while (spec.size() && (spec[0] == ' ' || spec[0] == '\t'))
		spec.erase(0, 1);
	while (spec.size() && (spec[spec.size() - 1] == ' ' || spec[spec.size() - 1] == '\t' || spec[spec.size() - 1] == '\r'))
		spec.erase(spec.size() - 1, 1);

	size_t dash = spec.find('-');
	if (dash == std::string::npos)
		return false;

	std::string a = spec.substr(0, dash);
	std::string b = spec.substr(dash + 1);

	long long start = 0;
	long long end = 0;

	// bytes=-N (last N bytes)
	if (a.empty())
	{
		long long suffix = af::stoi(b);
		if (suffix <= 0)
			return false;
		if (suffix > i_file_size)
			suffix = i_file_size;
		start = i_file_size - suffix;
		end = i_file_size - 1;
	}
	// bytes=N- (from N to end)
	else if (b.empty())
	{
		start = af::stoi(a);
		end = i_file_size - 1;
	}
	// bytes=N-M
	else
	{
		start = af::stoi(a);
		end = af::stoi(b);
	}

	if (start < 0)
		start = 0;
	if (end < 0)
		return false;

	if (start >= i_file_size)
	{
		// Unsatisfiable.
		if (o_start)
			*o_start = start;
		if (o_end)
			*o_end = end;
		return true;
	}

	if (end >= i_file_size)
		end = i_file_size - 1;
	if (end < start)
		return false;

	if (o_start)
		*o_start = start;
	if (o_end)
		*o_end = end;

	return true;
}

static std::string listDirectoryJson(const std::string &i_folder, std::string *o_error)
{
	if (o_error)
		o_error->clear();

	std::ostringstream o;
	o << "{\"path\":\"" << af::strEscape(i_folder) << "\",\"entries\":[";

#ifdef WINNT
	std::string mask = i_folder;
	if (mask.size() && (mask.back() != '\\') && (mask.back() != '/'))
		mask += "\\";
	mask += "*";

	WIN32_FIND_DATA file_data;
	HANDLE dir = FindFirstFile(mask.c_str(), &file_data);
	if (dir == INVALID_HANDLE_VALUE)
	{
		if (o_error)
			*o_error = "Can't open folder.";
		return "{}";
	}

	bool first = true;
	do
	{
		std::string name(file_data.cFileName);
		if ((name == ".") || (name == ".."))
			continue;

		bool is_dir = (file_data.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) != 0;
		unsigned long long size = (static_cast<unsigned long long>(file_data.nFileSizeHigh) << 32ULL) |
			static_cast<unsigned long long>(file_data.nFileSizeLow);

		if (false == first) o << ",";
		first = false;

		o << "{\"name\":\"" << af::strEscape(name) << "\",\"type\":\"" << (is_dir ? "dir" : "file") << "\"";
		if (false == is_dir)
			o << ",\"size\":" << size;
		o << "}";
	} while (FindNextFile(dir, &file_data));

	FindClose(dir);
#else
	struct dirent *de = NULL;
	DIR *dir = opendir(i_folder.c_str());
	if (dir == NULL)
	{
		if (o_error)
			*o_error = "Can't open folder.";
		return "{}";
	}

	bool first = true;
	while ((de = readdir(dir)))
	{
		std::string name(de->d_name);
		if ((name == ".") || (name == ".."))
			continue;

		std::string full = i_folder;
		if (full.size() && (full.back() != '/'))
			full += '/';
		full += name;

		struct stat st;
		if (-1 == stat(full.c_str(), &st))
			continue;

		bool is_dir = S_ISDIR(st.st_mode);
		if (false == first) o << ",";
		first = false;

		o << "{\"name\":\"" << af::strEscape(name) << "\",\"type\":\"" << (is_dir ? "dir" : "file") << "\"";
		if (false == is_dir)
			o << ",\"size\":" << static_cast<long long>(st.st_size);
		o << ",\"mtime\":" << static_cast<long long>(st.st_mtime);
		o << "}";
	}

	closedir(dir);
#endif

	o << "]}";
	return o.str();
}

af::Msg *HttpGet::process(const af::Msg *i_msg)
{
	af::Msg *o_msg = new af::Msg();

	const std::string file_name = HttpGet::getFileNameFromInMsg(i_msg);

	static const char list_prefix[] = "@LIST@";
	static const int list_prefix_len = strlen(list_prefix);
	if ((file_name.size() > list_prefix_len) && (file_name.compare(0, list_prefix_len, list_prefix) == 0))
	{
		std::string folder = file_name.substr(list_prefix_len);
		std::string error;

		normalizeLeadingSlash(folder);
		af::pathFilter(folder);

		if (false == af::pathIsAbsolute(folder))
		{
			std::string body = "{\"error\":\"Invalid path.\"}";
			std::string out = httpJsonResponse(body, "400 Bad Request");
			o_msg->setData(out.size(), out.c_str(), af::Msg::THTTPGET);
			return o_msg;
		}
		if (false == isPathAllowedForListing(folder))
		{
			std::string body = "{\"error\":\"Access denied.\"}";
			std::string out = httpJsonResponse(body, "403 Forbidden");
			o_msg->setData(out.size(), out.c_str(), af::Msg::THTTPGET);
			return o_msg;
		}

		std::string body = listDirectoryJson(folder, &error);
		if (error.size())
		{
			std::string out = httpJsonResponse("{\"error\":\"" + af::strEscape(error) + "\"}", "404 Not Found");
			o_msg->setData(out.size(), out.c_str(), af::Msg::THTTPGET);
			return o_msg;
		}

		std::string out = httpJsonResponse(body, "200 OK");
		o_msg->setData(out.size(), out.c_str(), af::Msg::THTTPGET);
		return o_msg;
	}

	std::string mimeType = HttpGet::getMimeTypeFromFileName(file_name);

	// Extra safety: some client paths can be odd (double slashes, url-encoded, etc).
	// Enforce common video MIME types based on filename suffix.
	{
		std::string lower = file_name;
		for (size_t i = 0; i < lower.size(); i++)
			lower[i] = static_cast<char>(std::tolower(static_cast<unsigned char>(lower[i])));

		if (lower.size() >= 4 && lower.compare(lower.size() - 4, 4, ".mov") == 0)
			mimeType = "video/quicktime";
		else if (lower.size() >= 4 && lower.compare(lower.size() - 4, 4, ".mp4") == 0)
			mimeType = "video/mp4";
		else if (lower.size() >= 5 && lower.compare(lower.size() - 5, 5, ".webm") == 0)
			mimeType = "video/webm";
	}

	// ### copy the file with proper http header to the output
	long long file_size_ll = 0;
	bool have_stat = false;
	if (file_name.size())
		have_stat = getRegularFileSize(file_name, &file_size_ll);

	// Range support (for video progressive loading and seeking):
	long long range_start = 0;
	long long range_end = 0;
	bool range_requested = false;
	bool range_unsatisfiable = false;
	if (have_stat && (file_size_ll > 0))
	{
		range_requested = parseHttpRangeHeader(i_msg, file_size_ll, &range_start, &range_end);
		if (range_requested && (range_start >= file_size_ll))
			range_unsatisfiable = true;
	}

	if (range_unsatisfiable)
	{
		std::string httpHeader = af::getHttpHeader(0, mimeType, "416 Range Not Satisfiable");
		httpHeader = injectHttpHeaderLine(httpHeader, "Accept-Ranges: bytes");
		httpHeader = injectHttpHeaderLine(httpHeader, "Content-Range: bytes */" + af::itos(file_size_ll));
		o_msg->setData(httpHeader.size(), httpHeader.c_str(), af::Msg::THTTPGET);
		return o_msg;
	}

	// Stream large files to avoid af::Msg size limits (~67MB).
	if (have_stat && (file_size_ll > 0))
	{
		bool stream_media = false;
		if (mimeType.find("video/") == 0)
			stream_media = true;
		else if (mimeType.find("image/") == 0)
			stream_media = true;
		else
		{
			std::string lower = file_name;
			for (size_t i = 0; i < lower.size(); i++)
				lower[i] = static_cast<char>(std::tolower(static_cast<unsigned char>(lower[i])));
			if ((lower.size() >= 4) && (lower.compare(lower.size() - 4, 4, ".obj") == 0))
				stream_media = true;
			else if ((lower.size() >= 4) && (lower.compare(lower.size() - 4, 4, ".mtl") == 0))
				stream_media = true;
		}

		static const long long stream_threshold = 2LL * 1024LL * 1024LL;
		const bool too_big_for_msg = ((file_size_ll + 4096LL) > static_cast<long long>(af::Msg::SizeDataMax));
		const bool too_big_for_int = (file_size_ll > 2147483647LL);
		const bool must_stream =
			range_requested ||
			too_big_for_msg ||
			too_big_for_int ||
			(stream_media && (file_size_ll >= stream_threshold));
		if (must_stream)
		{
			long long out_len_ll = file_size_ll;
			std::string status = "200 OK";
			long long out_offset_ll = 0;
			if (range_requested)
			{
				out_offset_ll = range_start;
				out_len_ll = range_end - range_start + 1;
				status = "206 Partial Content";
			}

			std::string httpHeader = httpHeader64(out_len_ll, mimeType, status);
			httpHeader = injectHttpHeaderLine(httpHeader, "Accept-Ranges: bytes");
			if (range_requested)
			{
				httpHeader = injectHttpHeaderLine(
					httpHeader,
					"Content-Range: bytes " + af::itos(out_offset_ll) + "-" + af::itos(out_offset_ll + out_len_ll - 1) + "/" + af::itos(file_size_ll)
				);
			}

			// Internal headers for socket layer streaming (stripped before sending to client):
			httpHeader = injectHttpHeaderLine(httpHeader, "X-Afanasy-File: " + file_name);
			if (range_requested)
			{
				httpHeader = injectHttpHeaderLine(httpHeader, "X-Afanasy-File-Offset: " + af::itos(out_offset_ll));
				httpHeader = injectHttpHeaderLine(httpHeader, "X-Afanasy-File-Length: " + af::itos(out_len_ll));
			}

			o_msg->setData(httpHeader.size(), httpHeader.c_str(), af::Msg::THTTPGET);
			return o_msg;
		}
	}

	int file_size = 0;
	char *file_data = NULL;
	if (file_name.size())
	{
		std::string error;
		file_data = af::fileRead(file_name, &file_size, -1, &error);
	}

	if (file_data)
	{
		std::string httpHeader = af::getHttpHeader(file_size, mimeType, "200 OK");
		httpHeader = injectHttpHeaderLine(httpHeader, "Accept-Ranges: bytes");

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
	static const char list_file[] = "@LIST@";
	static const int list_file_len = strlen(list_file);

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
		else if (file_name.find(list_file) == 0)
		{
			std::string encoded = file_name.substr(list_file_len);
			encoded = urlDecode(encoded);
			normalizeLeadingSlash(encoded);
			if (encoded.empty())
			{
				AFCommon::QueueLogError("GET: Empty @LIST@ path from "
					+ i_msg->getAddress().v_generateInfoString());
				file_name.clear();
			}
			else if (false == af::pathIsAbsolute(encoded))
			{
				AFCommon::QueueLogError("GET: Invalid @LIST@ path (not absolute): "
					+ encoded);
				file_name.clear();
			}
			else if (false == isPathAllowedForListing(encoded))
			{
				AFCommon::QueueLogError("GET: Access to '" + encoded +
					"' denied, not within allowed roots.");
				file_name.clear();
			}
			else
			{
				af::pathFilter(encoded);
				file_name = std::string(list_file) + encoded;
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
	size_t dot = filename.find_last_of(".");
	if (dot == std::string::npos)
		return "application/octet-stream";

	std::string extension = filename.substr(dot + 1);

	// Strip URL-like suffixes if any (should not happen here, but better safe than sorry).
	size_t suffix = extension.find_first_of("?#");
	if (suffix != std::string::npos)
		extension.erase(suffix);

	for (size_t i = 0; i < extension.size(); i++)
		extension[i] = static_cast<char>(std::tolower(static_cast<unsigned char>(extension[i])));

	if (extension == "css") return "text/css";
	if (extension == "js") return "text/javascript";
	if (extension == "json") return "application/json; charset=UTF-8";
	if (extension == "png") return "image/png";
	if ((extension == "jpeg") || (extension == "jpg")) return "image/jpeg";
	if (extension == "gif") return "image/gif";
	if ((extension == "htm") || (extension == "html")) return "text/html; charset=UTF-8";
	if (extension == "mp4") return "video/mp4";
	if (extension == "webm") return "video/webm";
	if ((extension == "mov") || (extension == "qt")) return "video/quicktime";
	if ((extension == "obj") || (extension == "mtl")) return "text/plain";
	if (extension == "exr") return "image/exr";
	if ((extension == "tif") || (extension == "tiff")) return "image/tiff";
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
