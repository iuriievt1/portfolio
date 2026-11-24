// ADR-005, backend.md 5, NAB-465
#define _GNU_SOURCE
#include <errno.h>
#include <fcntl.h>
#include <linux/landlock.h>
#include <stdio.h>
#include <string.h>
#include <sys/prctl.h>
#include <sys/stat.h>
#include <sys/syscall.h>
#include <unistd.h>

enum {
	ISOLATION_FAILED = 125,
	START_FAILED = 127,
	FIRST_ABI = 1,
	REFER_ABI = 2,
	TRUNCATE_ABI = 3,
	NETWORK_ABI = 4,
	DEVICE_IOCTL_ABI = 5,
	SCOPE_ABI = 6,
};

static const char NAME[] = "ocr-sandbox";
static const char SEPARATOR[] = "--";
static const char READ_OPTION[] = "--read";
static const char EXECUTE_OPTION[] = "--execute";
static const char WRITE_OPTION[] = "--write";

static const __u64 FIRST_ABI_ACCESS = LANDLOCK_ACCESS_FS_EXECUTE | LANDLOCK_ACCESS_FS_WRITE_FILE |
	LANDLOCK_ACCESS_FS_READ_FILE | LANDLOCK_ACCESS_FS_READ_DIR | LANDLOCK_ACCESS_FS_REMOVE_DIR |
	LANDLOCK_ACCESS_FS_REMOVE_FILE | LANDLOCK_ACCESS_FS_MAKE_CHAR | LANDLOCK_ACCESS_FS_MAKE_DIR |
	LANDLOCK_ACCESS_FS_MAKE_REG | LANDLOCK_ACCESS_FS_MAKE_SOCK | LANDLOCK_ACCESS_FS_MAKE_FIFO |
	LANDLOCK_ACCESS_FS_MAKE_BLOCK | LANDLOCK_ACCESS_FS_MAKE_SYM;
static const __u64 FILE_ACCESS = LANDLOCK_ACCESS_FS_EXECUTE | LANDLOCK_ACCESS_FS_WRITE_FILE |
	LANDLOCK_ACCESS_FS_READ_FILE | LANDLOCK_ACCESS_FS_TRUNCATE | LANDLOCK_ACCESS_FS_IOCTL_DEV;
static const __u64 READ_ACCESS = LANDLOCK_ACCESS_FS_READ_FILE | LANDLOCK_ACCESS_FS_READ_DIR;
static const __u64 EXECUTE_ACCESS = READ_ACCESS | LANDLOCK_ACCESS_FS_EXECUTE;
static const __u64 WRITE_ACCESS = READ_ACCESS | LANDLOCK_ACCESS_FS_WRITE_FILE | LANDLOCK_ACCESS_FS_MAKE_REG |
	LANDLOCK_ACCESS_FS_REMOVE_FILE | LANDLOCK_ACCESS_FS_TRUNCATE;
static const __u64 NETWORK_ACCESS = LANDLOCK_ACCESS_NET_BIND_TCP | LANDLOCK_ACCESS_NET_CONNECT_TCP;
static const __u64 SCOPES = LANDLOCK_SCOPE_ABSTRACT_UNIX_SOCKET | LANDLOCK_SCOPE_SIGNAL;

static int failed(const char *what, const char *subject) {
	fprintf(stderr, "%s: %s %s: %s\n", NAME, what, subject, strerror(errno));
	return ISOLATION_FAILED;
}

static __u64 handled_file_access(int abi) {
	__u64 access = FIRST_ABI_ACCESS;
	if (abi >= REFER_ABI) {
		access |= LANDLOCK_ACCESS_FS_REFER;
	}
	if (abi >= TRUNCATE_ABI) {
		access |= LANDLOCK_ACCESS_FS_TRUNCATE;
	}
	if (abi >= DEVICE_IOCTL_ABI) {
		access |= LANDLOCK_ACCESS_FS_IOCTL_DEV;
	}
	return access;
}

static __u64 access_of_option(const char *option) {
	if (strcmp(option, READ_OPTION) == 0) {
		return READ_ACCESS;
	}
	if (strcmp(option, EXECUTE_OPTION) == 0) {
		return EXECUTE_ACCESS;
	}
	if (strcmp(option, WRITE_OPTION) == 0) {
		return WRITE_ACCESS;
	}
	return 0;
}

static int allow_beneath(int ruleset, const char *path, __u64 access, __u64 handled) {
	int parent = open(path, O_PATH | O_CLOEXEC);
	if (parent < 0) {
		return -1;
	}
	struct stat status;
	if (fstat(parent, &status) != 0) {
		close(parent);
		return -1;
	}
	if (!S_ISDIR(status.st_mode)) {
		access &= FILE_ACCESS;
	}
	struct landlock_path_beneath_attr rule = { .allowed_access = access & handled, .parent_fd = parent };
	int result = (int)syscall(SYS_landlock_add_rule, ruleset, LANDLOCK_RULE_PATH_BENEATH, &rule, 0);
	close(parent);
	return result;
}

int main(int argc, char **argv) {
	int abi = (int)syscall(SYS_landlock_create_ruleset, NULL, 0, LANDLOCK_CREATE_RULESET_VERSION);
	if (abi < FIRST_ABI) {
		return failed("cannot use", "landlock");
	}
	struct landlock_ruleset_attr attributes = { .handled_access_fs = handled_file_access(abi) };
	if (abi >= NETWORK_ABI) {
		attributes.handled_access_net = NETWORK_ACCESS;
	}
	if (abi >= SCOPE_ABI) {
		attributes.scoped = SCOPES;
	}
	int ruleset = (int)syscall(SYS_landlock_create_ruleset, &attributes, sizeof(attributes), 0);
	if (ruleset < 0) {
		return failed("cannot create", "the ruleset");
	}
	int index = 1;
	for (; index < argc && strcmp(argv[index], SEPARATOR) != 0; index += 2) {
		__u64 access = access_of_option(argv[index]);
		if (access == 0 || index + 1 >= argc) {
			errno = EINVAL;
			return failed("cannot read the option", argv[index]);
		}
		if (allow_beneath(ruleset, argv[index + 1], access, attributes.handled_access_fs) != 0) {
			return failed("cannot allow", argv[index + 1]);
		}
	}
	if (index + 1 >= argc) {
		errno = EINVAL;
		return failed("cannot find", "the program");
	}
	if (prctl(PR_SET_NO_NEW_PRIVS, 1, 0, 0, 0) != 0) {
		return failed("cannot drop", "new privileges");
	}
	if (syscall(SYS_landlock_restrict_self, ruleset, 0) != 0) {
		return failed("cannot restrict", "itself");
	}
	close(ruleset);
	char **program = &argv[index + 1];
	execve(program[0], program, environ);
	fprintf(stderr, "%s: cannot start %s: %s\n", NAME, program[0], strerror(errno));
	return START_FAILED;
}
