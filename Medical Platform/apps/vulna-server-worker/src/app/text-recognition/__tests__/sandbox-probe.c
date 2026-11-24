// ADR-005, backend.md 5, NAB-465
#define _GNU_SOURCE
#include <arpa/inet.h>
#include <fcntl.h>
#include <netinet/in.h>
#include <stdio.h>
#include <string.h>
#include <sys/socket.h>
#include <unistd.h>

enum { REACHED_EXIT = 3, PATH_BYTES = 64 };

static const char PAGE_LIST[] = "pages.txt";
static const char OUTPUT[] = "document.pdf";
static const char LOOPBACK[] = "127.0.0.1";

static int reached = 0;

static void report(const char *what) {
	fprintf(stderr, "reached %s; ", what);
	reached = 1;
}

static int can_read(const char *path) {
	int descriptor = open(path, O_RDONLY | O_CLOEXEC);
	if (descriptor < 0) {
		return 0;
	}
	close(descriptor);
	return 1;
}

static int can_create(const char *directory) {
	char path[PATH_BYTES * 4];
	snprintf(path, sizeof(path), "%s/escaped", directory);
	int descriptor = open(path, O_WRONLY | O_CREAT | O_EXCL | O_CLOEXEC, 0600);
	if (descriptor < 0) {
		return 0;
	}
	close(descriptor);
	unlink(path);
	return 1;
}

static int can_connect(int port) {
	int connection = socket(AF_INET, SOCK_STREAM | SOCK_CLOEXEC, 0);
	if (connection < 0) {
		return 0;
	}
	struct sockaddr_in address = { .sin_family = AF_INET, .sin_port = htons((unsigned short)port) };
	inet_pton(AF_INET, LOOPBACK, &address.sin_addr);
	int result = connect(connection, (struct sockaddr *)&address, sizeof(address));
	close(connection);
	return result == 0;
}

static int page_count(void) {
	FILE *list = fopen(PAGE_LIST, "r");
	if (list == NULL) {
		return 0;
	}
	int count = 0;
	for (int character = fgetc(list); character != EOF; character = fgetc(list)) {
		count += character == '\n';
	}
	fclose(list);
	return count;
}

// CAP-022-R05
static int write_output(int pages) {
	FILE *output = fopen(OUTPUT, "w");
	if (output == NULL) {
		return 1;
	}
	fputs("%PDF-1.5\n3 0 obj\n<<\n  /BaseFont /GlyphLessFont\n  /Type /Font\n>>\nendobj\n", output);
	for (int index = 0; index < pages; index++) {
		fprintf(output, "%d 0 obj\n<<\n  /Type /Page\n  /Resources << /Font << /f-0-0 3 0 R >> >>\n>>\nendobj\n", 10 + index);
	}
	fputs("%%EOF\n", output);
	return fclose(output) != 0;
}

int main(void) {
	char parent_environment[PATH_BYTES];
	snprintf(parent_environment, sizeof(parent_environment), "/proc/%d/environ", (int)getppid());
	if (environ[0] != NULL) {
		report("the environment");
	}
	if (can_read(CONFIGURATION_FILE)) {
		report("the configuration");
	}
	if (can_read(FOREIGN_ARTEFACT)) {
		report("a foreign artefact in the binary store");
	}
	if (can_read(parent_environment)) {
		report("the environment of the worker");
	}
	if (can_create(OUTSIDE_DIRECTORY)) {
		report("a directory outside the attempt");
	}
	if (can_connect(LISTENING_PORT)) {
		report("the network");
	}
	if (reached) {
		return REACHED_EXIT;
	}
	return write_output(page_count());
}
