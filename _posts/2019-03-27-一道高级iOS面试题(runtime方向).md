---
layout:     post
title:      "一道高级iOS面试题(runtime方向)"
subtitle:   "runtime变态考题"
date:       2019-03-27 23:00:00
author:     "miniLV"
header-img: "img/post-bg-2015.jpg"
tags:
    - 面试
---

> *面试驱动技术合集（初中级iOS开发），关注仓库，及时获取更新* [Interview-series](https://github.com/miniLV/Interview-series)

![photo-1521120413309-42e7eada0334](https://user-gold-cdn.xitu.io/2019/3/31/169d447aa55fb28f?w=1500&h=1000&f=jpeg&s=119110)



说到iOS，要么公司规模比较小，<=3人，不需要面试。

其他的，大概率要让你刀枪棍棒十八般武艺都拿出来耍耍。

而其中，但凡敌军阵营中有iOSer的，又极大概率会考到 Runtime 的知识点。

以下，是一题 [sunnyxx](https://github.com/sunnyxx)的一道 [runtime 考题](https://blog.sunnyxx.com/2014/11/06/runtime-nuts/)，给大伙练练手，如果掌握了，Runtime层面的初中级问题应该都不在话下~



#### 题目来袭：

```
//MNPerson
@interface MNPerson : NSObject

@property (nonatomic, copy)NSString *name;

- (void)print;

@end

@implementation MNPerson

- (void)print{
    NSLog(@"self.name = %@",self.name);
}

@end

---------------------------------------------------

@implementation ViewController

- (void)viewDidLoad {

    [super viewDidLoad];
    
    id cls = [MNPerson class];
    
    void *obj = &cls;
    
    [(__bridge id)obj print];
    
}
```

问输出结果是啥，会不会崩溃。


![](https://user-gold-cdn.xitu.io/2019/3/31/169d44968ff6bab7?w=225&h=225&f=png&s=8339)

<br>




最终结果：

```
self.name = <ViewController: 0x7fe667608ae0>
```

what？

- 问题1：print 是实例方法，但是并没有哪里调用了 `[MNPerson alloc]init]` ?? 
- 问题2: 为啥打印了 viewController？



当前内存地址结构 - 与正常的` [person print]` 对比

![image-20190320211003867](https://user-gold-cdn.xitu.io/2019/3/31/169d447a7c8cacd3?w=1506&h=734&f=jpeg&s=228220)



- person变量的指针，执行 MNPerson 实例对象
- 实例对象的本身是个结构体，之前指向他，等价于执行结构体的第一个成员
- 结构体的第一个成员是isa，所以可以理解为，person->isa
- 所以两个print，其实内存结构一致
  - obj -> cls -> [MNPerson Class]
  - person -> isa -> [MNPerson Class]

> 调用print 方法，不需要关心有没有成员变量 `_name`，所以可以理解为，cls == isa



- 函数调用，是通过查找isa，其实本质，是查找结构体的前八个字节;
- 前八个字节正好是isa，所以这里可以理解为 cls == isa，这么理解的话，cls其实等于isa;
- 所以可以找得到 MNPerson 类，就可以找到MNPerson 类内部的方法，从而调用 `  print` 函数



**问题2：为啥里面打印的是 `ViewController`**



这就需要了解到iOS的内存分配相关知识



#### 内存分配

```
void test(){
    int a = 4;
    int b = 5;
    int c = 6;
    
    NSLog(@"a = %p,b = %p,c = %p",&a,&b,&c);
}
---------------------------
a = 0x7ffee87e9fdc,
b = 0x7ffee87e9fd8,
c = 0x7ffee87e9fd4
```

- 局部变量是在栈空间
- 上图可以发现，a先定义，a的地址比b高，得出结论：**栈的内存分配是从高地址到低地址**
- **栈的内存是连续的** (这点也很重要！！)



> OC方法的本质，其实是函数调用, 底层就是调用 objc_msgSend() 函数发送消息。



```
- (void)viewDidLoad {

    [super viewDidLoad];
    
    NSString  *test = @"666";
    
    id cls = [MNPerson class];
    
    void *obj = &cls;
    
    [(__bridge id)obj print];
    
}
```

以上述代码为例，三个变量 - test、cls、obj，都是局部变量，所以都在栈空间

栈空间是从高地址到低地址分配，所以test是最高地址，而obj是最低地址



MNPerson底层结构

```
struct MNPerson_IMPL{
    Class isa;
    NSString *_name;
}

- (void)print{
    NSLog(@"self.name = %@",self->_name);
}
```



1. 要打印的 `_name` 成员变量，其实是通过` self -> ` 去查找；
2. 这里的 self，就是函数调用者；
3. `[(__bridge id)obj print];`  即通过 obj 开始找；
4. 而找 `_name` ，是通过指针地址查找，找得` MNPerson_IMPL` 结构体
5. 因为这里的 `MNPerson_IMPL` 里面就两个变量，所以这里查找 `_name`，就是通过 ` isa`  的地址，跳过8个字节，找到 `_name`



![image-20190320214425257](https://user-gold-cdn.xitu.io/2019/3/31/169d447a9390b02a?w=1448&h=828&f=jpeg&s=235302)



而前面又说过，cls = isa，而_name 的地址 = isa往下偏移 8 个字节，所以上面的图可以转成

![image-20190320214534204](https://user-gold-cdn.xitu.io/2019/3/31/169d447a93b646e2?w=1348&h=782&f=jpeg&s=203840)



_name的本质，先找到 isa，然后跳过 isa 的八个字节，就找到 _name这个变量

所以上图输出

```
self.name = 666
```



最早没有 test变量的时候呢

```
- (void)viewDidLoad {

    [super viewDidLoad];
    
    id cls = [MNPerson class];
    
    void *obj = &cls;
    
    [(__bridge id)obj print];
    
}
```



####  [super viewDidLoad];做了什么



底层 - objc_msgSendSuper

` objc_msgSendSuper({ self, [ViewController class] },@selector(ViewDidLoad)),`



等价于：

```
struct temp = {
    self,
    [ViewController class] 
}

objc_msgSendSuper(temp, @selector(ViewDidLoad))
```

所以等于有个局部变量 - 结构体 temp，

结构体的地址 = 他的第一个成员，这里的第一个成员是self

![image-20190320215517076](https://user-gold-cdn.xitu.io/2019/3/31/169d447a938981ee?w=1433&h=1080&f=jpeg&s=348723)



所以等价于 _name = self = 当前ViewController，所以最后输出 

```
self.name = <ViewController: 0x7fc6e5f14970>
```



#### 话外篇 super 的本质



![image-20190320220159663](https://user-gold-cdn.xitu.io/2019/3/31/169d447a94ceae1a?w=1812&h=384&f=jpeg&s=176101)



**其实super的本质，不是 objc_msgSendSuper({self,[super class],@selector(xxx)}) **



而是

```
objc_msgSendSuper2(
{self,
[current class]//当前类
},
@selector(xxx)})
```

函数内部逻辑，拿到第二个成员 - 当前类，通过superClass指针找到他的父类，从superClass开始搜索，最终结果是差不多的~





---



友情演出:[小马哥MJ](https://github.com/CoderMJLee)



题目来源:

[神经病院入学考试](https://blog.sunnyxx.com/2014/11/06/runtime-nuts/)



[runtime消息机制理解](https://minilv.github.io/2019/03/17/Runtime-%E6%B6%88%E6%81%AF%E6%9C%BA%E5%88%B6%E5%9C%9F%E5%91%B3%E8%AE%B2%E8%A7%A3/)