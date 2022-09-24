#!/usr/bin/env node
const { WebSocketServer } = require('ws');
const { generateRandomPort } = require('./rand');
const child = require('child_process');
const crypto = require('crypto');

const randomPort = generateRandomPort();
const password = crypto.randomBytes(2).toString('hex').toUpperCase();

const fs = require('fs');

const pty = require('node-pty');

const wss = new WebSocketServer({
    port: randomPort,
    perMessageDeflate: false
});
const pidMap = new Map();
const detectShell = () => {
    console.log('Detecting your system environment...\nPlease waiting for a minute...');
    const isBashDetect = !child.spawnSync('bash').error;
    const isCmdDetect = !child.spawnSync('cmd.exe').error;
    const isPowerShellDetect = !child.spawnSync('powershell.exe').error;
    if (isBashDetect) {
        if (require('os').platform() === 'win32') {
            //git-bash
            const where_bash = child.execSync('where bash').toString().replace('\r', '').replace('\n', '');
            if (where_bash.length > 0) return where_bash;
        } else {
            return 'bash';
        };
    };
    if (isPowerShellDetect) return 'powershell.exe';
    if (isCmdDetect) return 'cmd.exe';
    console.error('Error: Cannot find Bash or CMD.');
    process.exit(0);
};

const usingShell = detectShell();

wss.on('connection', (ws) => {
    let isAuthenticated = false;
    ws.on('message', (msg, isBinary) => {
        try {
            msg = JSON.parse(msg);
        } catch (e) {
            ws.send(JSON.stringify({
                status: 'error',
                data: {
                    hasError: true,
                    error: {
                        type: 'Parse message failed',
                        source: e
                    }
                }
            }));
            return;
        }
        if (msg.do === 'login') {
            if (msg.passwd === password) isAuthenticated = true;
            else return ws.send(JSON.stringify({
                status: 'error',
                data: {
                    hasError: true,
                    error: {
                        type: 'Password wrong'
                    }
                }
            }));
            ws.send(JSON.stringify({
                status: 'ok',
                data: {
                    hasError: false,
                    type: 'Password correct.'
                }
            }));
        } else {
            if (!isAuthenticated) return ws.send(JSON.stringify({
                status: 'error',
                data: {
                    hasError: true,
                    error: {
                        type: 'Need authentication'
                    }
                }
            }));
            if (msg.do === 'createTerminal') {
                const cwd = (msg.cwd || process.env.HOME || process.env.USERPROFILE || './').replace('~', process.env.HOME || process.env.USERPROFILE || '.');
                var cwds = cwd.split('/');
                for (var i = 0; i < cwds.length; i++) {
                    try {
                        fs.mkdirSync(cwds.slice(0, i).join('/'))
                    } catch (e) {
                    };
                };//Try to make directories
                const terminal = pty.spawn(usingShell, ['--login'], {
                    //windowsHide: true,
                    cwd: cwd,
                    env: msg.env || process.env,
                });
                pidMap.set(terminal.pid, terminal);
                terminal.on('data', (data) => {
                    ws.send(JSON.stringify({
                        status: 'ok',
                        data: {
                            type: 'Received data',
                            data: data
                        }
                    }));
                });
                ws.on('close', () => {
                    terminal.kill();
                    pidMap.delete(terminal.pid);
                });
                ws.send(JSON.stringify({
                    status: 'ok',
                    data: {
                        hasError: false,
                        type: 'Create successfully',
                        pid: terminal.pid
                    }
                }));
            };
            if (msg.do === 'write-to-terminal') {
                const pid = msg.pid || 0;
                const terminal = pidMap.get(pid);
                if (!terminal) return ws.send(JSON.stringify({
                    status: 'error',
                    data: {
                        hasError: true,
                        type: 'Cannot find terminal'
                    }
                }));
                terminal.write(msg.data || '');

            };
            if (msg.do === 'kill-terminal') {
                const pid = msg.pid || 0;
                const terminal = pidMap.get(pid);
                if (!terminal) return ws.send(JSON.stringify({
                    status: 'error',
                    data: {
                        hasError: true,
                        type: 'Cannot find terminal'
                    }
                }));
                terminal.kill();
            };
        };
    });
});

let code = randomPort.toString(36);
while (code.length < 4) code = '0' + code;
code += password;

console.log('Please enter the following code in your remote terminal:');
console.log(code.toUpperCase());
