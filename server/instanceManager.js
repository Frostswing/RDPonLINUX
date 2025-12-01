const { v4: uuidv4 } = require('uuid');
const Session = require('./lib/Session');
const PortManager = require('./lib/PortManager');

class InstanceManager {
    constructor() {
        this.sessions = new Map();
        this.baseDisplay = 100;
        this.displayCounter = 0;
        
        const startVncPort = parseInt(process.env.PORT_RANGE_START) || 5900;
        const startWsPort = parseInt(process.env.WS_PORT_RANGE_START) || 6080;
        
        // We use simple counters for now as PortManager logic was simplified
        this.vncPortCounter = 0;
        this.wsPortCounter = 0;
        this.startVncPort = startVncPort;
        this.startWsPort = startWsPort;
    }

    async createInstance() {
        const id = uuidv4();
        
        // Allocate resources
        const offset = this.displayCounter++;
        const displayNum = this.baseDisplay + offset;
        const vncPort = this.startVncPort + offset;
        const wsPort = this.startWsPort + offset;

        console.log(`Creating session ${id} on :${displayNum} (VNC: ${vncPort}, WS: ${wsPort})`);

        const session = new Session(id, displayNum, vncPort, wsPort);
        this.sessions.set(id, session);

        try {
            await session.start();
            
            // Hook into session cleanup to remove from map
            // We can override the cleanup method or just poll/check
            // A better way is to have Session emit an event, but for now we'll wrap the cleanup
            const originalCleanup = session.cleanup.bind(session);
            session.cleanup = () => {
                originalCleanup();
                this.sessions.delete(id);
            };

            return {
                id,
                wsPort,
                display: session.display
            };
        } catch (err) {
            this.sessions.delete(id);
            throw err;
        }
    }

    getInstance(id) {
        const session = this.sessions.get(id);
        if (!session) return null;
        return {
            id: session.id,
            display: session.display,
            wsPort: session.wsPort,
            createdAt: session.createdAt
        };
    }

    listInstances() {
        return Array.from(this.sessions.values()).map(s => ({
            id: s.id,
            display: s.display,
            wsPort: s.wsPort,
            createdAt: s.createdAt
        }));
    }

    stopInstance(id) {
        const session = this.sessions.get(id);
        if (session) {
            session.cleanup();
            this.sessions.delete(id);
            return true;
        }
        return false;
    }
}

module.exports = new InstanceManager();
