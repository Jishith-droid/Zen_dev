#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#ifdef _WIN32
#include <direct.h>
#include <winsock2.h>
#include <ws2tcpip.h>
#include <psapi.h>
#pragma comment(lib, "ws2_32.lib")
#include <windows.h>
#else
#include <sys/stat.h>
#endif
#include <stdbool.h>
#include <time.h>
#include <unistd.h>
#include <netdb.h>
#include <pwd.h>
#include <sys/utsname.h>
#include <sys/sysinfo.h>

double zen_sys_performance() {

#ifdef _WIN32
    static LARGE_INTEGER freq;
    static int initialized = 0;

    if (!initialized) {
        QueryPerformanceFrequency(&freq);
        initialized = 1;
    }

    LARGE_INTEGER counter;
    QueryPerformanceCounter(&counter);

    return (double)counter.QuadPart * 1000.0 / (double)freq.QuadPart;

#else
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);

    return (double)ts.tv_sec * 1000.0 +
           (double)ts.tv_nsec / 1e6;
#endif

}

char* sys_input(const char* prompt) {

    char buf[1024];

    if (prompt != NULL) {
        printf("%s", prompt);
        fflush(stdout);
    }

    if (!fgets(buf, sizeof(buf), stdin)) {
        buf[0] = '\0';
    }

    // remove newline
    size_t len = strlen(buf);
    if (len > 0 && buf[len - 1] == '\n') {
        buf[len - 1] = '\0';
    }

    // allocate fresh memory per call (CRITICAL FIX)
    char* out = (char*)malloc(len + 1);
    
    if (!out) {
    fprintf(stderr, "\033[1;31m[Zen  MemoryError]\n  └── Failed to allocate memory for input buffer\033[0m\n");
    exit(1);
}

    strcpy(out, buf);

    return out;
}

void _sys_panic(const char* msg) {
    // ANSI red color
    fprintf(stderr, "\033[1;31m");

    fprintf(stderr, "[Zen  PanicError]\n  └── %s\n", msg);

    // reset color
    fprintf(stderr, "\033[0m");

    // stop program immediately
    exit(1);
}

void _sys_color(const char *color) {

    // NORMAL COLORS
    if (strcmp(color, "black") == 0)
        printf("\033[30m");

    else if (strcmp(color, "red") == 0)
        printf("\033[31m");

    else if (strcmp(color, "green") == 0)
        printf("\033[32m");

    else if (strcmp(color, "yellow") == 0)
        printf("\033[33m");

    else if (strcmp(color, "blue") == 0)
        printf("\033[34m");

    else if (strcmp(color, "magenta") == 0)
        printf("\033[35m");

    else if (strcmp(color, "cyan") == 0)
        printf("\033[36m");

    else if (strcmp(color, "white") == 0)
        printf("\033[37m");

    // BRIGHT COLORS
    else if (strcmp(color, "brightBlack") == 0)
        printf("\033[90m");

    else if (strcmp(color, "brightRed") == 0)
        printf("\033[91m");

    else if (strcmp(color, "brightGreen") == 0)
        printf("\033[92m");

    else if (strcmp(color, "brightYellow") == 0)
        printf("\033[93m");

    else if (strcmp(color, "brightBlue") == 0)
        printf("\033[94m");

    else if (strcmp(color, "brightMagenta") == 0)
        printf("\033[95m");

    else if (strcmp(color, "brightCyan") == 0)
        printf("\033[96m");

    else if (strcmp(color, "brightWhite") == 0)
        printf("\033[97m");

    // STYLES
    else if (strcmp(color, "bold") == 0)
        printf("\033[1m");

    else if (strcmp(color, "underline") == 0)
        printf("\033[4m");

    else if (strcmp(color, "reverse") == 0)
        printf("\033[7m");

    // RESET
    else if (strcmp(color, "reset") == 0)
        printf("\033[0m");

    fflush(stdout);
}

const char* _time_time() {
    static char buffer[32];

    time_t now = time(NULL);
    struct tm *t = localtime(&now);

    snprintf(
        buffer,
        sizeof(buffer),
        "%02d:%02d:%02d",
        t->tm_hour,
        t->tm_min,
        t->tm_sec
    );

    return buffer;
}

long long _time_millis() {

#ifdef _WIN32

    return GetTickCount64();

#else

    struct timespec ts;

    clock_gettime(CLOCK_REALTIME, &ts);

    return ((long long)ts.tv_sec * 1000LL)
           + (ts.tv_nsec / 1000000LL);

#endif
}

int _time_date() {
    time_t now = time(NULL);
    return localtime(&now)->tm_mday;
}

int _time_month() {
    time_t now = time(NULL);
    return localtime(&now)->tm_mon + 1;
}

int _time_day() {
    time_t now = time(NULL);
    return localtime(&now)->tm_wday;
}

int _time_year() {
    time_t now = time(NULL);
    return localtime(&now)->tm_year + 1900;
}

#ifdef _WIN32

const char* _os_battery() {

    static char result[64];

    SYSTEM_POWER_STATUS s;

    if (!GetSystemPowerStatus(&s)) {
        return "unknown#0";
    }

    const char *state =
        s.ACLineStatus == 1 ? "charging" : "discharging";

    sprintf(
        result,
        "%s#%d",
        state,
        s.BatteryLifePercent
    );

    return result;
}

#else


const char* _os_battery() {

    static char result[64];

    FILE *f = fopen(
        "/sys/class/power_supply/BAT0/capacity",
        "r"
    );

    if (!f) {
        return "unknown#0";
    }

    int percent;
    fscanf(f, "%d", &percent);
    fclose(f);

    f = fopen(
        "/sys/class/power_supply/BAT0/status",
        "r"
    );

    char status[32] = "unknown";

    if (f) {
        fscanf(f, "%31s", status);
        fclose(f);
    }

    sprintf(
        result,
        "%s#%d",
        status,
        percent
    );

    return result;
}

#endif

bool _net_online() {

#ifdef _WIN32
    WSADATA wsa;
    WSAStartup(MAKEWORD(2,2), &wsa);
#endif

    struct addrinfo *res;

    if (getaddrinfo("google.com", "80", NULL, &res) != 0) {
        return false;
    }

#ifdef _WIN32

    SOCKET sock = socket(
        res->ai_family,
        res->ai_socktype,
        res->ai_protocol
    );

    bool ok = connect(
        sock,
        res->ai_addr,
        (int)res->ai_addrlen
    ) == 0;

    closesocket(sock);
    WSACleanup();

#else

    int sock = socket(
        res->ai_family,
        res->ai_socktype,
        res->ai_protocol
    );

    bool ok = connect(
        sock,
        res->ai_addr,
        res->ai_addrlen
    ) == 0;

    close(sock);

#endif

    freeaddrinfo(res);

    return ok;
}

int _os_cpuCount() {
#ifdef _WIN32
    SYSTEM_INFO si;
    GetSystemInfo(&si);
    return (int)si.dwNumberOfProcessors;
#else
    long n = sysconf(_SC_NPROCESSORS_ONLN);
    return (n > 0) ? (int)n : 1;
#endif
}

// ---------------- ARCH ----------------

const char* _os_cpuArch() {
#ifdef _WIN32
    return "x86/amd64-windows";
#else
    static struct utsname u;
    if (uname(&u) == 0)
        return u.machine;
    return "unknown";
#endif
}

// ---------------- CPU MODEL ----------------

const char* _os_cpuModel() {
#ifdef _WIN32
    return "windows-cpu";
#else
    static char model[128];
    FILE *f = fopen("/proc/cpuinfo", "r");
    if (!f) return "unknown";

    while (fgets(model, sizeof(model), f)) {
        if (strstr(model, "model name") || strstr(model, "Hardware")) {
            fclose(f);
            char *p = strchr(model, ':');
            return p ? p + 2 : model;
        }
    }

    fclose(f);
    return "unknown";
#endif
}

// ---------------- CPU SPEED ----------------

double _os_cpuSpeed() {
#ifdef _WIN32
    return -1;
#else
    FILE *f = fopen("/proc/cpuinfo", "r");
    if (!f) return -1;

    char line[128];
    double mhz = -1;

    while (fgets(line, sizeof(line), f)) {
        if (sscanf(line, "cpu MHz : %lf", &mhz) == 1) {
            fclose(f);
            return  mhz / 1000;
        }
    }

    fclose(f);

    // Android fallback (optional, safer than fake 0)
    FILE *g = fopen("/sys/devices/system/cpu/cpu0/cpufreq/cpuinfo_max_freq", "r");
    if (g) {
        long khz = 0;
        if (fscanf(g, "%ld", &khz) == 1) {
            fclose(g);
            return khz / 1000.0;
        }
        fclose(g);
    }

    return -1;
#endif
}

// ---------------- MEMORY ----------------

long _os_totalMemory() {
#ifdef _WIN32
    MEMORYSTATUSEX status;
    status.dwLength = sizeof(status);
    if (GlobalMemoryStatusEx(&status))
        return (long)(status.ullTotalPhys);
    return -1;
#else
    FILE *f = fopen("/proc/meminfo", "r");
    if (!f) return -1;

    long mem = -1;
    if (fscanf(f, "MemTotal: %ld kB", &mem) != 1)
        mem = -1;

    fclose(f);
    return mem * 1024;
#endif
}

long _os_freeMemory() {
#ifdef _WIN32
    MEMORYSTATUSEX status;
    status.dwLength = sizeof(status);
    if (GlobalMemoryStatusEx(&status))
        return (long)(status.ullAvailPhys);
    return -1;
#else
    FILE *f = fopen("/proc/meminfo", "r");
    if (!f) return -1;

    char line[128];
    long mem = -1;

    while (fgets(line, sizeof(line), f)) {
        if (sscanf(line, "MemAvailable: %ld kB", &mem) == 1) {
            fclose(f);
            return mem * 1024;
        }
    }

    fclose(f);
    return -1;
#endif
}

long _os_usedMemory() {
    long t = _os_totalMemory();
    long f = _os_freeMemory();

    if (t == -1 || f == -1) return -1;
    return t - f;
}

// ---------------- PROCESS MEMORY ----------------

long _os_processMemory() {
#ifdef _WIN32
    PROCESS_MEMORY_COUNTERS pmc;
    if (GetProcessMemoryInfo(GetCurrentProcess(), &pmc, sizeof(pmc)))
        return (long)(pmc.WorkingSetSize / 1024);
    return -1;
#else
    FILE *f = fopen("/proc/self/status", "r");
    if (!f) return -1;

    char line[128];
    long mem = -1;

    while (fgets(line, sizeof(line), f)) {
        if (sscanf(line, "VmRSS: %ld kB", &mem) == 1) {
            fclose(f);
            return mem * 1024;
        }
    }

    fclose(f);
    return -1;
#endif
}

// ---------------- OS INFO ----------------

const char* _os_osName() {
#ifdef _WIN32
    return "Windows";
#else
    static struct utsname u;
    if (uname(&u) == 0)
        return u.sysname;
    return "Linux";
#endif
}

const char* _os_osVersion() {
#ifdef _WIN32
    return "Windows-version";
#else
    static struct utsname u;
    if (uname(&u) == 0)
        return u.release;
    return "unknown";
#endif
}

// ---------------- HOSTNAME ----------------

char* _os_hostname() {
    char tmp[256];

#ifdef _WIN32
    DWORD size = 256;
    if (!GetComputerNameA(tmp, &size))
        return strdup("unknown");
#else
    if (gethostname(tmp, sizeof(tmp)) != 0)
        return strdup("unknown");
#endif

    tmp[sizeof(tmp) - 1] = '\0';

    char *out = (char*)malloc(strlen(tmp) + 1);
    if (!out) return strdup("unknown");

    strcpy(out, tmp);
    return out;
}

// ---------------- USERNAME ----------------

const char* _os_username() {
#ifdef _WIN32
    static char name[128];
    DWORD size = sizeof(name);
    if (GetUserNameA(name, &size))
        return name;
    return "unknown";
#else
    const char *u = getenv("USER");
    if (u) return u;

    u = getenv("LOGNAME");
    if (u) return u;

    return "unknown";
#endif
}

// ---------------- UPTIME ----------------

double _os_uptime() {
#ifdef _WIN32
    return GetTickCount64() / 1000.0;
#else
    FILE *f = fopen("/proc/uptime", "r");
    if (f) {
        double t = -1;
        if (fscanf(f, "%lf", &t) == 1) {
            fclose(f);
            return t;
        }
        fclose(f);
    }

    // fallback (Android/Linux safe)
    #ifdef __linux__
    struct sysinfo info;
    if (sysinfo(&info) == 0) {
        return (double)info.uptime;
    }
    #endif

    return -1;
#endif
}

int _fs_changeDir(const char *path) {
    return chdir(path);
}

char* _fs_cwd() {
    char *buf = malloc(1024);
    if (!buf) return NULL;

    return getcwd(buf, 1024);
}

const char* _sys_getEnv(const char *key) {
    const char *val = getenv(key);
    return val ? val : "";
}

char* _fs_readFile(const char* path) {
    FILE* f = fopen(path, "rb");
    if (!f) {
        char* empty = (char*)malloc(1);
        empty[0] = '\0';
        return empty;
    }

    fseek(f, 0, SEEK_END);
    long size = ftell(f);
    rewind(f);

    char* buffer = (char*)malloc(size + 1);
    if (!buffer) {
        fclose(f);
        char* empty = (char*)malloc(1);
        empty[0] = '\0';
        return empty;
    }

    fread(buffer, 1, size, f);
    buffer[size] = '\0';

    fclose(f);
    return buffer;
}

void zen_sleep(int ms) {

#ifdef _WIN32
    Sleep(ms);
#else
    struct timespec ts;
    ts.tv_sec = ms / 1000;
    ts.tv_nsec = (ms % 1000) * 1000000;
    nanosleep(&ts, NULL);
#endif

}

int _sys_exec(const char *cmd) {
    if (!cmd) return -1;
    return system(cmd);
}

int _fs_writeFile(const char* path, const char* content) {
    FILE* f = fopen(path, "wb");

    if (!f) {
        return 0;
    }

    size_t written = fwrite(content, 1, strlen(content), f);

    fclose(f);

    return written > 0 ? 0 : 1;
}

int _fs_appendFile(const char *path, const char *content) {
    FILE *f = fopen(path, "a");
    if (!f) return 1;

    fputs(content, f);
    fclose(f);

    return 0;
}


bool _fs_exists(const char *path) {
    #ifdef _WIN32
return GetFileAttributesA(path) != INVALID_FILE_ATTRIBUTES;
#else
return access(path, F_OK) == 0;
#endif
}

int _fs_deleteFile(const char *path) {
    return remove(path);
}

int _fs_renameFile(const char *oldname, const char *newname) {
    return rename(oldname, newname);
}

int _fs_makeDir(const char *path) {

#ifdef _WIN32
    return _mkdir(path);
#else
    return mkdir(path, 0755);
#endif

}

char* int_to_string(int x) {
    char* res = (char*)malloc(20);
    
    int i = 0;
    int isNeg = 0;

    if (x == 0) {
        res[i++] = '0';
        res[i] = '\0';
        return res;
    }

    if (x < 0) {
        isNeg = 1;
        x = -x;
    }

    char temp[20];
    int t = 0;

    while (x > 0) {
        temp[t++] = (x % 10) + '0';
        x /= 10;
    }

    if (isNeg) {
        res[i++] = '-';
    }

    while (t > 0) {
        res[i++] = temp[--t];
    }

    res[i] = '\0';
    return res;
}

//
// ===============================
// DOUBLE → STRING
// ===============================
//
char* double_to_string(double x) {
    char buffer[64];
    snprintf(buffer, sizeof(buffer), "%f", x);

    char* res = (char*)malloc(strlen(buffer) + 1);
    strcpy(res, buffer);

    return res;
}

//
// ===============================
// BOOL → STRING
// ===============================
//
char* bool_to_string(bool x) {
    const char* str = x ? "true" : "false";

    char* res = (char*)malloc(strlen(str) + 1);
    strcpy(res, str);

    return res;
}


int string_to_int(char* str) {
    if (str == NULL) return 0;

    int result = 0;
    int i = 0;
    int sign = 1;

    if (str[0] == '-') {
        sign = -1;
        i++;
    }

    while (str[i] != '\0') {
        if (str[i] < '0' || str[i] > '9') {
            break; // or handle error
        }

        result = result * 10 + (str[i] - '0');
        i++;
    }

    return result * sign;
}

int string_to_int_ascii(char *str) {
    int result = 0;

    while (*str) {
        result += (int)(*str);
        str++;
    }

    return result;
}

char* int_to_string_ascii(int value) {
    char *out = (char*)malloc(2);

    out[0] = (char)value;
    out[1] = '\0';

    return out;
}

//
// ===============================
// STRING → DOUBLE
// ===============================
//
double string_to_double(char* str) {
    if (str == NULL) return 0.0;
    return atof(str);
}

//
// ===============================
// STRING → BOOL
// ===============================
//
bool string_to_bool(char* str) {
    return (str != NULL && strlen(str) > 0);
}

//
// ===============================
// OPTIONAL: FREE STRING
// ===============================
//
void free_string(char* str) {
    if (str != NULL) {
        free(str);
    }
}

char* str_concat(const char* a, const char* b) {
    if (!a) a = "";
    if (!b) b = "";

    size_t len_a = strlen(a);
    size_t len_b = strlen(b);

    char* res = (char*)malloc(len_a + len_b + 1);
    if (!res) return NULL;

    memcpy(res, a, len_a);
    memcpy(res + len_a, b, len_b);
    res[len_a + len_b] = '\0';

    return res;
}

char* zen_char_to_string(char c) {
    char* s = (char*)malloc(2);
    s[0] = c;
    s[1] = '\0';
    return s;
}
