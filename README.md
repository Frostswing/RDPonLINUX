# Antigravity RDP

**Antigravity RDP** is a web-based remote desktop solution designed to run isolated instances of the "Antigravity" application (or any X11 application) on a central server and stream them to any web browser.

This allows you to access your workspace from devices that don't natively support the application, such as tablets or Chromebooks, simply by opening a URL (e.g., over a Tailscale VPN).

## Goals
- **Web Accessibility**: Run heavy desktop apps on a server and access them via a lightweight web client.
- **Isolation**: Each session runs in its own virtual display (`Xvfb`) with its own window manager (`fluxbox`) and isolated user data.
- **Immersive Experience**: The web client provides a full-screen, app-like experience with no distracting browser UI.
- **Seamless Lifecycle**: Instances are created on demand and automatically cleaned up when the application exits.

## Architecture
- **Backend**: Node.js & Express. Manages the lifecycle of X11 processes.
- **Frontend**: React & Vite. Provides the dashboard and VNC viewer.
- **Core Technologies**:
    - `Xvfb`: Virtual Framebuffer for headless X11 display.
    - `Fluxbox`: Lightweight window manager (configured to be invisible).
    - `x11vnc`: VNC server for the virtual display.
    - `websockify`: Bridges VNC (TCP) to WebSockets for the browser.
    - `noVNC`: HTML5 VNC client library.

## Prerequisites
Ensure the following system packages are installed on the host (Ubuntu):

```bash
sudo apt-get install fluxbox x11vnc websockify xvfb
```

You also need **Node.js** (v18+) and **npm**.

## Installation

1.  **Clone the repository**:
    ```bash
    git clone <repository-url>
    cd antigravityRDP
    ```

2.  **Install Backend Dependencies**:
    ```bash
    npm install
    ```

3.  **Install Frontend Dependencies**:
    ```bash
    cd client
    npm install
    cd ..
    ```

4.  **Configuration**:
    Create a `.env` file in the root directory (optional, defaults provided):
    ```env
    ANTIGRAVITY_COMMAND=xterm  # Command to launch your app
    PORT_RANGE_START=5900      # Starting port for VNC
    WS_PORT_RANGE_START=6080   # Starting port for WebSockets
    SERVER_PORT=3000           # Backend API port
    ```

## Usage

1.  **Start the Backend Server**:
    ```bash
    node server/index.js
    ```

2.  **Start the Frontend Client**:
    Open a new terminal:
    ```bash
    cd client
    npm run dev
    ```

3.  **Access**:
    Open your browser and navigate to `http://localhost:5173` (or your server's IP/Tailscale address).
    - Click **"New Instance"** to launch a fresh desktop session.
    - Click **"Connect"** to enter the session.
    - The session will auto-close when you exit the application inside the remote desktop.

## License
MIT
