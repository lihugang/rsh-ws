# Remote Shell - WebSocket
## rsh-ws
- - -
### 协议：MIT
- - -
## 怎么使用？
1. 首先，全局安装此项目，运行`npm i rsh-ws -g`  
2. 使用`rsh-ws`来启动服务  
3. 服务会在终端打印连接代码，例如`0O0P5D99`，前4位是端口号码，后4位是连接密码，端口号码请使用36进制解析，在这个例子中，端口号码是`31129`  
4. 使用`WebSocket`连接`ws://ip:31129`，如果是本机，ip可以为`127.9.9.9`  
5. 执行命令，例如，在本例子中，连接密码是`5D99`，你可以发送JSON命令
```json
{
    "password": "5D99",
    "type": "exec",
    "cmd": "ls",
    "cwd": "./",
    "stdin": ""
}
```
`cmd`为你要执行的命令，`cwd`为执行命令的目录位置，`stdin`是标准输入  
6. 执行命令完成后会返回如下格式
```json
{
    "status": "ok",
    "data": {
        "type": "finished",
        "hasError": false,
        "error": null,
        "stdout": "index.js\nnode_modules\npackage.json\nrand.js\nREADME.md\n",
        "stderr": "",
        "id": 7528
    }
}
```