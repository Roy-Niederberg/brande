#/*
cat > .clangd <<EOF
CompileFlags:
  Add: [-std=c++20, -Wsign-conversion]
EOF
cat > .clang-format <<EOF
BasedOnStyle: LLVM
IndentWidth: 8
TabWidth: 8
UseTab: Never
EOF
clang++ -std=c++20 -Werror -Wsign-conversion -pedantic -ggdb3 \
  -Og -o output $0 -fno-omit-frame-pointer \
  && ./output;
exit;
*/

#include <sys/inotify.h>
#include <sys/socket.h>
#include <sys/stat.h>
#include <sys/un.h>
#include <poll.h>
#include <unistd.h>
#include <cctype>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <filesystem>
#include <fstream>
#include <string>

namespace fs = std::filesystem;

constexpr auto CLIENTS_DIR  = "/home/brande/app/clients";
constexpr auto CONFIG_DIR   = "/home/brande/app/config";
constexpr auto SOCKET_PATH  = "/run/qabu/conductor.sock";
constexpr auto DOMAIN       = "qabu.net";
constexpr int  MAX_CLIENTS  = 128;
constexpr int  MAX_TIER     = 5;
constexpr int  RECONCILE_MS = 60'000;
constexpr int  HEALTH_TRIES = 15;
constexpr int  HEALTH_WAIT  = 2; // seconds between curl attempts

struct Watch { int wd; char dir[256]; };

static int   g_inotify;
static Watch g_watches[MAX_CLIENTS];
static int   g_watch_n = 0;

// ── helpers ──────────────────────────────────────────────────────────────────

static bool run_ok(const char* cmd) { return system(cmd) == 0; }

// Subdomain rule: 5-20 chars, lowercase letters/digits/hyphens, start+end with letter.
// MUST stay in sync with SUBDOMAIN_RE in services/client_onboarding/src/server.js.
static bool valid_sub(const char* s) {
        int n = strlen(s);
        if (n < 5 || n > 20) return false;
        if (!islower(s[0]) || !islower(s[n-1])) return false;
        for (int i = 1; i < n-1; i++)
                if (!islower(s[i]) && !isdigit(s[i]) && s[i] != '-') return false;
        return true;
}

// ── docker ───────────────────────────────────────────────────────────────────

static bool stack_running(const char* dir) {
        char cmd[512];
        snprintf(cmd, sizeof(cmd),
                 "docker compose -f %s/docker-compose.yml --env-file %s/private/config.env"
                 " ps -q --status running | grep -q .",
                 dir, dir);
        return run_ok(cmd);
}

static void start_stack(const char* dir) {
        char cmd[512];
        snprintf(cmd, sizeof(cmd),
                 "docker compose -f %s/docker-compose.yml --env-file %s/private/config.env pull -q;"
                 "docker compose -f %s/docker-compose.yml --env-file %s/private/config.env up -d --remove-orphans",
                 dir, dir, dir, dir);
        system(cmd);
}

// ── inotify ──────────────────────────────────────────────────────────────────

static void add_watch(const char* watch_path, const char* client_dir) {
        if (g_watch_n >= MAX_CLIENTS) return;
        int wd = inotify_add_watch(g_inotify, watch_path, IN_CLOSE_WRITE | IN_MOVED_TO);
        if (wd < 0) return;
        g_watches[g_watch_n] = {wd, {}};
        strncpy(g_watches[g_watch_n++].dir, client_dir, 255);
}

static void watch_client(const char* dir) {
        add_watch(dir, dir);
        char data_dir[512];
        snprintf(data_dir, sizeof(data_dir), "%s/data", dir);
        if (fs::exists(data_dir)) add_watch(data_dir, dir);
        char private_dir[512];
        snprintf(private_dir, sizeof(private_dir), "%s/private", dir);
        if (fs::exists(private_dir)) add_watch(private_dir, dir);
}

static const char* find_watch_dir(int wd) {
        for (int i = 0; i < g_watch_n; i++)
                if (g_watches[i].wd == wd) return g_watches[i].dir;
        return nullptr;
}

static void handle_inotify() {
        alignas(inotify_event) char buf[4096];
        ssize_t nr = read(g_inotify, buf, sizeof(buf));
        if (nr <= 0) return;
        for (size_t i = 0; i < (size_t)nr;) {
                auto* ev = reinterpret_cast<inotify_event*>(buf + i);
                i += sizeof(inotify_event) + ev->len;
                if (!ev->len) continue;
                if (strcmp(ev->name, "docker-compose.yml") != 0 &&
                    strcmp(ev->name, "config.env") != 0) continue;
                const char* dir = find_watch_dir(ev->wd);
                if (!dir) continue;
                printf("[conductor] compose changed: %s\n", dir);
                start_stack(dir);
        }
}

// ── reconcile ────────────────────────────────────────────────────────────────

static void reconcile() {
        printf("[conductor] reconcile\n");
        for (auto& e : fs::directory_iterator(CLIENTS_DIR)) {
                if (!e.is_directory()) continue;
                auto p = e.path().string();
                if (!fs::exists(p + "/docker-compose.yml")) continue;

                bool watching = false;
                for (int i = 0; i < g_watch_n; i++)
                        if (strcmp(g_watches[i].dir, p.c_str()) == 0) { watching = true; break; }
                if (!watching) watch_client(p.c_str());

                if (!stack_running(p.c_str())) {
                        printf("[conductor] starting: %s\n", p.c_str());
                        start_stack(p.c_str());
                }
        }
}

// ── health check ─────────────────────────────────────────────────────────────

static bool health_check(const char* sub) {
        char cmd[256];
        snprintf(cmd, sizeof(cmd),
                 "curl -skf --max-time 3 -H 'Host: %s.%s' https://127.0.0.1/ >/dev/null 2>&1",
                 sub, DOMAIN);
        for (int i = 0; i < HEALTH_TRIES; i++) {
                if (run_ok(cmd)) return true;
                sleep(HEALTH_WAIT);
        }
        return false;
}

// ── create client ─────────────────────────────────────────────────────────────

static int dir_count() {
        int n = 0;
        for (auto& e : fs::directory_iterator(CLIENTS_DIR))
        if (e.is_directory()) n++;
        return n;
}

static void template_file(const std::string& path, const char* sub) {
        std::ifstream in(path);
        std::string content((std::istreambuf_iterator<char>(in)), {});
        in.close();
        std::string placeholder = "{{subdomain}}";
        for (size_t pos = 0; (pos = content.find(placeholder, pos)) != std::string::npos;)
                content.replace(pos, placeholder.size(), sub);
        std::ofstream(path) << content;
}

static const char* create_client(const char* sub, int tier) {
        if (!valid_sub(sub))               return "err 400";
        char dir[512];
        snprintf(dir, sizeof(dir), "%s/%s", CLIENTS_DIR, sub);
        if (fs::exists(dir))               return "err 409";
        if (dir_count() + tier > MAX_TIER) return "err 507";

        fs::copy(CONFIG_DIR, dir, fs::copy_options::recursive);
        auto config_json = std::string(dir) + "/private/client-config.json";
        if (fs::exists(config_json)) template_file(config_json, sub);
        watch_client(dir);
        start_stack(dir);

        return health_check(sub) ? "ok" : "err 503";
}

// ── socket ────────────────────────────────────────────────────────────────────

static int setup_socket() {
        fs::create_directories("/run/qabu");
        unlink(SOCKET_PATH);
        int fd = socket(AF_UNIX, SOCK_STREAM, 0);
        sockaddr_un addr{};
        addr.sun_family = AF_UNIX;
        strncpy(addr.sun_path, SOCKET_PATH, sizeof(addr.sun_path) - 1);
        if (bind(fd, reinterpret_cast<sockaddr*>(&addr), sizeof(addr)) < 0) {
                perror("conductor: bind"); exit(1);
        }
        listen(fd, 8);
        chmod(SOCKET_PATH, 0666);
        return fd;
}

static void handle_connection(int server_fd) {
        int fd = accept(server_fd, nullptr, nullptr);
        if (fd < 0) return;
        char buf[128] = {};
        read(fd, buf, sizeof(buf) - 1);
        char sub[64] = {};
        int tier = 1;
        sscanf(buf, "%63s %d", sub, &tier);
        const char* resp = create_client(sub, tier);
        printf("[conductor] create '%s' tier=%d → %s\n", sub, tier, resp);
        write(fd, resp, strlen(resp));
        write(fd, "\n", 1);
        close(fd);
}

// ── main ──────────────────────────────────────────────────────────────────────

int main() {
        setbuf(stdout, NULL);
        fs::create_directories(CLIENTS_DIR);
        g_inotify = inotify_init1(IN_NONBLOCK);
        for (auto& e : fs::directory_iterator(CLIENTS_DIR))
        if (e.is_directory()) watch_client(e.path().c_str());

        int sock = setup_socket();
        reconcile();

        pollfd fds[] = {{g_inotify, POLLIN, 0}, {sock, POLLIN, 0}};
        while (true) {
                int n = poll(fds, 2, RECONCILE_MS);
                if (n < 0) continue; // EINTR
                if (n == 0) { reconcile(); continue; }
                if (fds[0].revents & POLLIN) handle_inotify();
                if (fds[1].revents & POLLIN) handle_connection(sock);
        }
}
