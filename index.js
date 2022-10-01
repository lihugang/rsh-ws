#!/usr/bin/env node
const { WebSocketServer } = require('ws');
const { generateRandomPort } = require('./rand');
const package = require('./package.json');
const child = require('child_process');
const crypto = require('crypto');
const express = require('express');

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
            if (msg.do === 'get-version') {
                ws.send(JSON.stringify({
                    status: 'ok',
                    data: {
                        type: 'version',
                        version: package.version
                    }
                }));
            };
            if (msg.do === 'file-operation') {
                var filepath = (msg.path || './LICENSE').replace('~', process.env.HOME || process.env.USERPROFILE || '.');
                var paths = filepath.split('/');
                for (var i = 0; i < paths.length; i++) {
                    try {
                        fs.mkdirSync(paths.slice(0, i).join('/'))
                    } catch (e) {
                    };
                };
                const randomFileID = crypto.randomBytes(8).toString('hex').toUpperCase();
                app_file.set(randomFileID, filepath);
                ws.send(JSON.stringify({
                    status: 'ok',
                    data: {
                        port: app_random_port,
                        file_id: randomFileID,
                        path: msg.path
                    }
                }));
            };
        };
    });
});

const app = express();
const app_file = new Map();
app.all('*', (req, res, next) => {
    res.setHeader('access-control-allow-origin', '*');
    res.setHeader('access-control-allow-methods', 'GET, PUT, DELETE, OPTIONS');
    res.setHeader('access-control-max-age', '86400');
    return next();
});
app.options('*', (req, res) => res.sendStatus(200));
app.get('/:file_id', (req, res) => {
    if (!app_file.has(req.params.file_id)) return res.sendStatus(404);
    if (fs.existsSync(app_file.get(req.params.file_id))) {
        //file exists
        res.status(200);
        const readStream = fs.createReadStream(app_file.get(req.params.file_id));
        readStream.pipe(res);
    } else return res.sendStatus(404);
});
app.put('/:file_id', (req, res) => {
    if (!app_file.has(req.params.file_id)) return res.sendStatus(404);
    try {
        const writeStream = fs.createWriteStream(app_file.get(req.params.file_id));
        req.pipe(writeStream);
        writeStream.on('close', () => res.sendStatus(201));
    } catch (e) {
        res.status(500).send(e.message + '\n' + e.stack);
    };
});
app.delete('/:file_id', (req, res) => {
    if (!app_file.has(req.params.file_id)) return res.sendStatus(404);
    try {
        fs.unlinkSync(app_file.get(req.params.file_id));
        res.sendStatus(204);
    } catch (e) {
        res.status(500).send(e.message + '\n' + e.stack);
    };
});
app.get('/', (req, res) => res.status(200).send('File operation server of rsh-ws'));
const app_random_port = generateRandomPort();
app.listen(app_random_port);

let code = randomPort.toString(36);
while (code.length < 4) code = '0' + code;
code += password;

console.log('Please enter the following code in your remote terminal:');
console.log(code.toUpperCase());
