// Sends a request to the conductor socket and prints the response.
// Usage: ./testclient "subdomain tier"
#include <sys/socket.h>
#include <sys/un.h>
#include <unistd.h>
#include <cstdio>
#include <cstring>

int main(int argc, char* argv[]) {
    if (argc < 2) return 1;
    int fd = socket(AF_UNIX, SOCK_STREAM, 0);
    sockaddr_un addr{};
    addr.sun_family = AF_UNIX;
    strncpy(addr.sun_path, "/run/qabu/conductor.sock", sizeof(addr.sun_path) - 1);
    if (connect(fd, reinterpret_cast<sockaddr*>(&addr), sizeof(addr)) < 0) {
        perror("connect"); return 1;
    }
    write(fd, argv[1], strlen(argv[1]));
    write(fd, "\n", 1);
    shutdown(fd, SHUT_WR);
    char buf[64] = {};
    read(fd, buf, sizeof(buf) - 1);
    close(fd);
    int n = strlen(buf);
    if (n > 0 && buf[n-1] == '\n') buf[n-1] = '\0';
    puts(buf);
    return 0;
}
