#!/usr/bin/env node
const { WebSocketServer } = require('ws');
const { generateRandomPort } = require('./rand');
const child = require('child_process');
const crypto = require('crypto');

const randomPort = generateRandomPort();
const password = crypto.randomBytes(2).toString('hex').toUpperCase();

const wss = new WebSocketServer({
    port: randomPort,
    perMessageDeflate: false
});
const map = new Map();
wss.on('connection', (ws) => {
    ws.on('message', (msg, isBinary) => {
        try {
            msg = JSON.parse(msg);
        } catch (e) {
            ws.send(JSON.stringify({
                status: 'error',
                data: e.toString()
            }));
        };
        if (msg.password === password) {
            if (msg.type === 'exec') {
                msg.command = msg.command || msg.cmd || 'echo >/dev/null';
                msg.stdin = msg.stdin || '';
                const obj = child.exec(msg.command, {
                    cwd: msg.cwd || './',
                    windowsHide: true,
                }, (error, stdout, stderr) => {
                    if (error)
                        console.log(stderr);
                    ws.send(JSON.stringify({
                        status: 'ok',
                        data: {
                            type: 'finished',
                            hasError: !!error,
                            error: error,
                            stdout: stdout,
                            stderr: stderr,
                            id: obj.pid
                        }
                    }));
                });
                obj.stdin.write(msg.stdin);
                obj.stdout.on('data', (data) => {
                    ws.send(JSON.stringify({
                        status: 'ok',
                        data: {
                            type: 'stdout-print',
                            data: data.toString()
                        }
                    }));
                });
                ws.send(JSON.stringify({
                    status: 'ok',
                    data: {
                        id: obj.pid
                    },
                }));
                map.set(obj.pid, obj);
            } else if (msg.type === 'write-to-stdin') {
                const pid = msg.pid || 0;
                const obj = map.get(pid);
                if (!obj) return;
                obj.stdin.write(msg.data || '');
            }
        } else ws.send(JSON.stringify({
            status: 'error',
            data: 'Password does not match'
        }));
    });
});

let code = randomPort.toString(36);
while (code.length < 4) code = '0' + code;
code += password;

console.log('Please enter the following code in your remote terminal:');
console.log(code.toUpperCase());
