const net = require('net');

class PortManager {
    constructor(startPort) {
        this.startPort = startPort;
        this.currentOffset = 0;
    }

    async findFreePort(offset = 0) {
        let port = this.startPort + this.currentOffset + offset;
        while (!(await this.isPortFree(port))) {
            port++;
            this.currentOffset++;
        }
        return port;
    }

    isPortFree(port) {
        return new Promise((resolve) => {
            const server = net.createServer();
            server.once('error', () => resolve(false));
            server.once('listening', () => {
                server.close();
                resolve(true);
            });
            server.listen(port);
        });
    }

    // Simple monotonic allocation for now, assuming we don't run out of ports
    // In a real system, we'd recycle ports.
    allocate() {
        const port = this.startPort + this.currentOffset;
        this.currentOffset++;
        return port;
    }
}

module.exports = PortManager;
