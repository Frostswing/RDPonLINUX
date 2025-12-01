const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class Session {
    constructor(id, displayNum, vncPort, wsPort, options = {}) {
        this.id = id;
        this.displayNum = displayNum;
        this.display = `:${displayNum}`;
        this.vncPort = vncPort;
        this.wsPort = wsPort;
        this.width = options.width || 1920;
        this.height = options.height || 1080;
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
            // Start with a large framebuffer to allow resizing
            const xvfb = spawn('Xvfb', [this.display, '-screen', '0', '4096x4096x24']);
            xvfb.on('error', reject);
            this.processes.xvfb = xvfb;
            
            // Give Xvfb a moment to start, then set initial resolution
            setTimeout(async () => {
                try {
                    await this.resize(this.width, this.height);
                    resolve();
                } catch (err) {
                    console.error('Failed to set initial resolution:', err);
                    resolve(); // Continue anyway
                }
            }, 1000);
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
            args.push('--start-fullscreen');
            args.push('--no-sandbox');
            args.push('--disable-gpu');
            args.push('--disable-software-rasterizer');
            // args.push(`--window-size=${this.width},${this.height}`); // Let fullscreen handle it
            
            const extensionsDir = path.join(process.env.HOME, '.antigravity/extensions');
            if (fs.existsSync(extensionsDir)) {
                args.push('--extensions-dir', extensionsDir);
            }
        }

        console.log(`Spawning app: ${appCommand} ${args.join(' ')}`);

        // Try to find a dbus wrapper, or fall back to direct execution
        let spawnCommand = appCommand;
        let spawnArgs = args;

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

    resize(width, height) {
        return new Promise((resolve, reject) => {
            if (!width || !height) {
                resolve();
                return;
            }
            console.log(`Resizing session ${this.id} to ${width}x${height}`);
            this.width = width;
            this.height = height;

            // 1. Generate modeline using cvt
            const cvt = spawn('cvt', [width, height]);
            let cvtOutput = '';
            cvt.stdout.on('data', d => cvtOutput += d.toString());
            
            cvt.on('close', (code) => {
                if (code !== 0) {
                    console.error('cvt failed');
                    reject(new Error('cvt failed'));
                    return;
                }

                // Parse modeline
                // Example: Modeline "1920x1080_60.00"  173.00  1920 2048 2248 2576  1080 1083 1088 1120 -hsync +vsync
                const match = cvtOutput.match(/Modeline\s+"([^"]+)"\s+(.*)/);
                if (!match) {
                    console.error('Failed to parse cvt output');
                    reject(new Error('Failed to parse cvt output'));
                    return;
                }

                const modeName = match[1];
                const modeParams = match[2];

                // 2. Add new mode
                const xrandrNewMode = spawn('xrandr', ['-display', this.display, '--newmode', modeName, ...modeParams.split(/\s+/).filter(Boolean)]);
                
                xrandrNewMode.on('close', () => {
                    // 3. Add mode to output (assuming 'screen' as output name based on previous check)
                    // We should dynamically find output name, but 'screen' is standard for Xvfb
                    const outputName = 'screen'; 
                    const xrandrAddMode = spawn('xrandr', ['-display', this.display, '--addmode', outputName, modeName]);
                    
                    xrandrAddMode.on('close', () => {
                        // 4. Set mode
                        const xrandrSetMode = spawn('xrandr', ['-display', this.display, '--output', outputName, '--mode', modeName]);
                        
                        xrandrSetMode.on('close', (code) => {
                            if (code === 0) {
                                console.log(`Successfully resized to ${width}x${height}`);
                                resolve();
                            } else {
                                console.error('Failed to set mode');
                                reject(new Error('Failed to set mode'));
                            }
                        });
                    });
                });
            });
        });
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
