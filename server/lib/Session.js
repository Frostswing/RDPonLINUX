const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class Session {
    constructor(id, displayNum, vncPort, wsPort) {
        this.id = id;
        this.displayNum = displayNum;
        this.display = `:${displayNum}`;
        this.vncPort = vncPort;
        this.wsPort = wsPort;
        this.userDataDir = path.join('/tmp', `antigravity-${id}`);
        this.processes = {};
        this.createdAt = new Date();
    }

    async start() {
        this.setupDirectories();
        this.setupFluxbox();

        try {
            await this.startXvfb();
            await this.startWindowManager();
            await this.startVnc();
            await this.startWebsockify();
            // Start app last
            this.startApp(); 
        } catch (err) {
            console.error(`Session ${this.id} failed to start:`, err);
            this.cleanup();
            throw err;
        }
    }

    setupDirectories() {
        if (!fs.existsSync(this.userDataDir)) {
            fs.mkdirSync(this.userDataDir, { recursive: true });
        }
        // Copy User settings
        const sourceUserDir = path.join(process.env.HOME, '.config/Antigravity/User');
        const targetUserDir = path.join(this.userDataDir, 'User');
        if (fs.existsSync(sourceUserDir)) {
            try {
                require('child_process').execSync(`cp -r "${sourceUserDir}" "${targetUserDir}"`);
            } catch (err) {
                console.error(`Failed to copy user settings: ${err.message}`);
            }
        }
    }

    setupFluxbox() {
        const fluxboxInitPath = path.join(this.userDataDir, 'fluxbox-init');
        const fluxboxAppsPath = path.join(this.userDataDir, 'fluxbox-apps');
        
        const fluxboxInitContent = `
session.screen0.toolbar.visible: false
session.screen0.toolbar.tools: prevworkspace, workspacename, nextworkspace, iconbar, systemtray, clock
session.appsFile: ${fluxboxAppsPath}
`;
        const fluxboxAppsContent = `
[app] (name=.*)
  [Deco] {NONE}
  [Maximize] {yes}
  [Layer] {DESKTOP}
[end]
`;
        fs.writeFileSync(fluxboxInitPath, fluxboxInitContent);
        fs.writeFileSync(fluxboxAppsPath, fluxboxAppsContent);
    }

    startXvfb() {
        return new Promise((resolve, reject) => {
            const xvfb = spawn('Xvfb', [this.display, '-screen', '0', '1920x1080x24']);
            xvfb.on('error', reject);
            this.processes.xvfb = xvfb;
            // Give Xvfb a moment to start
            setTimeout(resolve, 500);
        });
    }

    startWindowManager() {
        return new Promise((resolve) => {
            const wmCommand = process.env.WINDOW_MANAGER || 'fluxbox';
            const fluxboxInitPath = path.join(this.userDataDir, 'fluxbox-init');
            const wm = spawn(wmCommand, ['-display', this.display, '-rc', fluxboxInitPath], {
                env: { ...process.env, DISPLAY: this.display }
            });
            wm.stdout.on('data', d => console.log(`WM stdout: ${d}`));
            wm.stderr.on('data', d => console.error(`WM stderr: ${d}`));
            this.processes.wm = wm;
            setTimeout(resolve, 500);
        });
    }

    startVnc() {
        return new Promise((resolve) => {
            const vnc = spawn('x11vnc', [
                '-display', this.display,
                '-rfbport', this.vncPort.toString(),
                '-forever',
                '-shared',
                '-nopw'
            ]);
            vnc.stdout.on('data', d => console.log(`VNC stdout: ${d}`));
            vnc.stderr.on('data', d => console.error(`VNC stderr: ${d}`));
            this.processes.vnc = vnc;
            resolve();
        });
    }

    startWebsockify() {
        return new Promise((resolve) => {
            const ws = spawn('websockify', [
                `100.100.42.11:${this.wsPort}`,
                `localhost:${this.vncPort}`
            ]);
            ws.stdout.on('data', d => console.log(`WS stdout: ${d}`));
            ws.stderr.on('data', d => console.error(`WS stderr: ${d}`));
            this.processes.ws = ws;
            resolve();
        });
    }

    startApp() {
        const appCommand = process.env.ANTIGRAVITY_COMMAND || 'xterm';
        const args = [];
        const env = { 
            ...process.env, 
            DISPLAY: this.display,
            // Force Software Rendering
            LIBGL_ALWAYS_SOFTWARE: '1',
            // Disable GPU for Electron
            ELECTRON_DISABLE_GPU: '1'
        };

        if (appCommand.includes('antigravity')) {
            args.push('--wait');
            args.push('--user-data-dir', this.userDataDir);
            args.push('--start-maximized');
            args.push('--no-sandbox');
            args.push('--disable-gpu');
            args.push('--disable-software-rasterizer');
            args.push('--window-size=1920,1080');
            
            const extensionsDir = path.join(process.env.HOME, '.antigravity/extensions');
            if (fs.existsSync(extensionsDir)) {
                args.push('--extensions-dir', extensionsDir);
            }
        }

        console.log(`Spawning app: ${appCommand} ${args.join(' ')}`);

        console.log(`Spawning app: ${appCommand} ${args.join(' ')}`);

        // Try to find a dbus wrapper, or fall back to direct execution
        let spawnCommand = appCommand;
        let spawnArgs = args;

        // We can't easily check for existence synchronously without 'which' or 'fs.access' on path
        // So we'll try to spawn directly for now to fix the ENOENT
        // If the user installs dbus-x11, they can uncomment or we can add detection later
        
        // NOTE: If you have dbus-x11 installed, you can use:
        // spawnCommand = 'dbus-launch';
        // spawnArgs = ['--exit-with-session', appCommand, ...args];

        const app = spawn(spawnCommand, spawnArgs, { env });
        
        app.stdout.on('data', d => console.log(`App stdout: ${d}`));
        app.stderr.on('data', d => console.error(`App stderr: ${d}`));
        
        app.on('error', (err) => {
            console.error(`App failed to start: ${err.message}`);
            // If the app fails to start, we should probably cleanup
            this.cleanup();
        });
        
        app.on('exit', (code) => {
            console.log(`App exited with code ${code}. Cleaning up session ${this.id}`);
            this.cleanup();
        });

        this.processes.app = app;
    }

    cleanup() {
        console.log(`Cleaning up session ${this.id}`);
        Object.values(this.processes).forEach(p => {
            if (p && !p.killed) {
                try { p.kill(); } catch (e) {}
            }
        });
        
        if (this.userDataDir && fs.existsSync(this.userDataDir)) {
            try {
                fs.rmSync(this.userDataDir, { recursive: true, force: true });
            } catch (err) {
                console.error(`Failed to cleanup user data dir: ${err.message}`);
            }
        }
    }
}

module.exports = Session;
