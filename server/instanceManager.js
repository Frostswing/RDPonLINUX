const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

class InstanceManager {
    constructor() {
        this.instances = new Map();
        this.baseDisplay = 100;
        this.baseVncPort = parseInt(process.env.PORT_RANGE_START) || 5900;
        this.baseWsPort = parseInt(process.env.WS_PORT_RANGE_START) || 6080;
        this.instanceCounter = 0;
    }

    createInstance() {
        const id = uuidv4();
        // Use monotonic counter to avoid collisions and race conditions
        const offset = this.instanceCounter++; 
        const displayNum = this.baseDisplay + offset;
        const vncPort = this.baseVncPort + offset;
        const wsPort = this.baseWsPort + offset;
        const display = `:${displayNum}`;

        console.log(`Creating instance ${id} on display ${display}, VNC ${vncPort}, WS ${wsPort}`);

        // Reserve the instance immediately to prevent race conditions (though counter handles uniqueness)
        const instance = {
            id,
            display,
            vncPort,
            wsPort,
            wsPort,
            processes: {},
            userDataDir: path.join('/tmp', `antigravity-${id}`),
            createdAt: new Date()
        };
        this.instances.set(id, instance);

        // Create user data directory
        if (!fs.existsSync(instance.userDataDir)) {
            fs.mkdirSync(instance.userDataDir, { recursive: true });
        }

        // Copy User settings
        const sourceUserDir = path.join(process.env.HOME, '.config/Antigravity/User');
        const targetUserDir = path.join(instance.userDataDir, 'User');
        if (fs.existsSync(sourceUserDir)) {
            try {
                // Use cp -r for reliable recursive copy on Linux
                require('child_process').execSync(`cp -r "${sourceUserDir}" "${targetUserDir}"`);
            } catch (err) {
                console.error(`Failed to copy user settings: ${err.message}`);
            }
        }

        // Create minimal Fluxbox init to hide toolbar
        const fluxboxInitPath = path.join(instance.userDataDir, 'fluxbox-init');
        const fluxboxAppsPath = path.join(instance.userDataDir, 'fluxbox-apps');
        
        const fluxboxInitContent = `
session.screen0.toolbar.visible: false
session.screen0.toolbar.tools: prevworkspace, workspacename, nextworkspace, iconbar, systemtray, clock
session.appsFile: ${fluxboxAppsPath}
`;
        // Force Antigravity (and other apps) to be maximized and undecorated
        // Note: Fluxbox regex matching can be tricky. Using .* should match everything.
        const fluxboxAppsContent = `
[app] (name=.*)
  [Deco] {NONE}
  [Maximize] {yes}
  [Layer] {DESKTOP}
[end]
`;

        try {
            fs.writeFileSync(fluxboxInitPath, fluxboxInitContent);
            fs.writeFileSync(fluxboxAppsPath, fluxboxAppsContent);
        } catch (err) {
            console.error(`Failed to create fluxbox config: ${err.message}`);
        }

        // 1. Start Xvfb - Increase resolution to 1920x1080
        const xvfb = spawn('Xvfb', [display, '-screen', '0', '1920x1080x24']);
        xvfb.on('error', (err) => {
            console.error(`Failed to start Xvfb: ${err.message}`);
            this.cleanupInstance(id);
        });
        instance.processes.xvfb = xvfb;

        // 2. Start Window Manager (Fluxbox)
        setTimeout(() => {
            const wmCommand = process.env.WINDOW_MANAGER || 'fluxbox';
            // Use -rc to specify the custom init file
            const wmArgs = ['-display', display, '-rc', fluxboxInitPath];
            
            const wm = spawn(wmCommand, wmArgs, {
                env: { ...process.env, DISPLAY: display }
            });
            wm.on('error', (err) => {
                console.error(`Failed to start Window Manager (${wmCommand}): ${err.message}`);
            });
            if (this.instances.has(id)) this.instances.get(id).processes.wm = wm;
        }, 500);

        // 3. Start Application
        setTimeout(() => {
            const appCommand = process.env.ANTIGRAVITY_COMMAND || 'xterm';
            const args = [];
            // If it's the antigravity app (VS Code based), add user-data-dir to isolate it and force new window
            if (appCommand.includes('antigravity')) {
                args.push('--wait'); // Wait for window to close to prevent immediate exit
                args.push('--user-data-dir', instance.userDataDir);
                args.push('--start-maximized'); 
                args.push('--no-sandbox'); // Required for some environments
                args.push('--disable-gpu'); // prevent rendering issues
                args.push('--window-size=1920,1080'); // Force size match
                
                // Use existing extensions
                const extensionsDir = path.join(process.env.HOME, '.antigravity/extensions');
                if (fs.existsSync(extensionsDir)) {
                    args.push('--extensions-dir', extensionsDir);
                }
            }

            const app = spawn(appCommand, args, {
                env: { ...process.env, DISPLAY: display }
            });
            app.on('error', (err) => {
                console.error(`Failed to start App (${appCommand}): ${err.message}`);
            });
            
            // Cleanup when the application exits
            app.on('exit', (code) => {
                console.log(`App exited with code ${code}, cleaning up instance ${id}`);
                this.cleanupInstance(id);
            });

            if (this.instances.has(id)) this.instances.get(id).processes.app = app;
        }, 1000);

        // 4. Start x11vnc
        const vnc = spawn('x11vnc', [
            '-display', display,
            '-rfbport', vncPort.toString(),
            '-forever',
            '-shared',
            '-nopw' 
        ]);
        vnc.on('error', (err) => {
             console.error(`Failed to start x11vnc: ${err.message}`);
             this.cleanupInstance(id);
        });
        instance.processes.vnc = vnc;

        // 5. Start websockify
        const ws = spawn('websockify', [
            wsPort.toString(),
            `localhost:${vncPort}`
        ]);
        ws.on('error', (err) => {
             console.error(`Failed to start websockify: ${err.message}`);
             this.cleanupInstance(id);
        });
        instance.processes.ws = ws;

        // Cleanup on exit
        xvfb.on('exit', () => this.cleanupInstance(id));

        return {
            id,
            wsPort,
            display
        };
    }

    cleanupInstance(id) {
        if (!this.instances.has(id)) return;
        const instance = this.instances.get(id);
        console.log(`Cleaning up instance ${id}`);
        Object.values(instance.processes).forEach(p => {
            if (p && !p.killed) p.kill();
        });
        
        // Cleanup user data directory
        if (instance.userDataDir && fs.existsSync(instance.userDataDir)) {
            try {
                fs.rmSync(instance.userDataDir, { recursive: true, force: true });
            } catch (err) {
                console.error(`Failed to cleanup user data dir ${instance.userDataDir}: ${err.message}`);
            }
        }

        this.instances.delete(id);
    }

    getInstance(id) {
        return this.instances.get(id);
    }

    listInstances() {
        return Array.from(this.instances.values()).map(i => ({
            id: i.id,
            display: i.display,
            wsPort: i.wsPort,
            createdAt: i.createdAt
        }));
    }

    stopInstance(id) {
        const instance = this.instances.get(id);
        if (instance) {
            Object.values(instance.processes).forEach(p => p.kill());
            this.instances.delete(id);
            return true;
        }
        return false;
    }
}

module.exports = new InstanceManager();
