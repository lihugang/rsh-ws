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
    "do": "login",
    "passwd": "5D99"
}
```来登录
6. 创建终端
```json
{
    "do": "createTerminal",
    "cwd": "./", //终端目录
}
```
返回值中有 `data.pid` 参数，用来标识终端
7. 发送命令
```json
{
    "pid": "<pid>",
    "do": "write-to-terminal",
    "data": "ls"
}
```
这会向终端的`stdin`写入`data`
8. 返回命令结果
格式为
```json
{
    "status": "ok",
    "data": {
        "type": "Received data",
        "data": "<data here>"
    }
}
```
