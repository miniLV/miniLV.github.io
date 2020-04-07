---
layout:     post
title:      "iOS - 添加一个全局悬浮按钮"
subtitle:   "集成pods版"
date:       2019-01-30 16:00:00
author:     "miniLV"
header-img: "img/post-bg-2015.jpg"
tags:
    - 工具
---

*背景介绍 ：在普通的iOS开发组中，一般测试机都不止一台，但是我们在开发的时候，不可能每台测试机时刻保持最新的代码，这就出现了一个问题，当测试测出问题的时候，(或者产品突然拿去点点看的时候出了问题)如果不知道当前的版本，可能不确定是什么时候出的问题。*

![made in 小蠢驴的配图](https://github.com/miniLV/github_images_miniLV/tree/master/juejin/168a2d6d5de66c8d?raw=true)


>解决方案：如果当前环境是测试服的时候，展示一个全局浮动标签，这样不仅看到此标志就告诉测试(包括我们自己)当前的环境，当出现问题的时候，通过标签，可以快速定位当前问题发生的版本号等等

<br>

![需求设计图.png](https://github.com/miniLV/github_images_miniLV/tree/master/juejin/168a3021b7941302?raw=true)

#### 思路：
- 由于要全局显示，所以必须加在最上层（window层）
- 由于需求图中有文字和背景图片，优先考虑UIButton（当然，如果有勇士非要用UIView，里面放imageView 和 label也o98k）
- 由于此图片不是半透明，会挡住后面的内容，所以这个标签必须可以拖动 - 考虑添加拖拽手势
- 本质上可以理解为，创建一个UIButton，为其添加拖拽手势，然后将其添加到UIWindow显示

---

<br>

#### 知识1：按钮显示2行文字
```
//UIbutton的换行显示
button.titleLabel.lineBreakMode = NSLineBreakByWordWrapping;

//然后如同title的内容用包含“\n”就会换行
title = @“123\n666”
```

#### 知识2：Version 与 Build号的获取
```
NSString *versionStr = [[[NSBundle
       mainBundle]infoDictionary]valueForKey:@"CFBundleShortVersionString"];
NSString *buildStr = [[[NSBundle
       mainBundle]infoDictionary]valueForKey:@"CFBundleVersion"];
```
![image.png](https://github.com/miniLV/github_images_miniLV/tree/master/juejin/168a2d6d5e1e9cdc?raw=true)

#### 知识3：控件的移动 - 本质上:坐标 ++
```
//拖动改变控件的水平方向x值
- (CGRect)changeXWithFrame:(CGRect)originalFrame point:(CGPoint)point{
    BOOL q1 = originalFrame.origin.x >= 0;
    BOOL q2 = originalFrame.origin.x + originalFrame.size.width <= screenW;
    
    if (q1 && q2) {
        originalFrame.origin.x += point.x;
    }
    return originalFrame;
}

//拖动改变控件的竖直方向y值
- (CGRect)changeYWithFrame:(CGRect)originalFrame point:(CGPoint)point{
    
    BOOL q1 = originalFrame.origin.y >= 0;
    BOOL q2 = originalFrame.origin.y + originalFrame.size.height <= screenH;
    if (q1 && q2) {
        originalFrame.origin.y += point.y;
    }
    return originalFrame;
}
```

#### 知识4：控件的移动 - 越界处理(跑到屏幕外了)
```
//记录该button是否屏幕越界
        BOOL isOver = NO;
        if (frame.origin.x < 0) {
            frame.origin.x = 0;
            isOver = YES;
            
        } else if (frame.origin.x + frame.size.width > screenW) {
            frame.origin.x = screenW - frame.size.width;
            isOver = YES;
        }

        if (frame.origin.y < 0) {
            frame.origin.y = 0;
            isOver = YES;
            
        } else if (frame.origin.y+frame.size.height > screenH) {
            frame.origin.y = screenH - frame.size.height;
            isOver = YES;
        }
        
        if (isOver) {
            //如果越界-跑回来
            [UIView animateWithDuration:0.3 animations:^{
                self.frame = frame;
            }];
        }
```

#### 知识5：封装需求 - 如果限制只能水平 or 竖直滑动 or 全局滑动
```
MNAssistiveTouchTypeNone = 0,         //没限制随便移动
MNAssistiveTouchTypeVerticalScroll,   //只能垂直移动
MNAssistiveTouchTypeHorizontalScroll, //只能竖直移动
```

```
  switch (type) {
        case MNAssistiveTouchTypeNone:
        {
            水平方向坐标 ++；
            竖直方向坐标 ++；
            break;
        }case MNAssistiveTouchTypeHorizontalScroll:{
            竖直方向坐标 ++；
            break;
        }
        case MNAssistiveTouchTypeVerticalScroll:{
            水平方向坐标 ++；
            break;
        }
    }
```

#### 使用方法
>##### 0.下载[demo文件](https://github.com/miniLV/LevitationButtonDemo)
>##### 1.引入“MNAssistiveBtn”文件
>##### 2.进入“AppDelegate.m”
>##### 3.在  `- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions{...}` 方法中，添加以下两句代码
```
    //示例demo样式
    MNAssistiveBtn *btn = [MNAssistiveBtn mn_touchWithType:MNAssistiveTouchTypeHorizontalScroll
                                                     Frame:frame
                                                     title:title
                                                titleColor:[UIColor whiteColor]
                                                 titleFont:[UIFont systemFontOfSize:11]
                                           backgroundColor:nil
                                           backgroundImage:[UIImage imageNamed:@"test"]];
    [self.window addSubview:btn];
```
<br>

#### 最终样式展示~

![demo.gif](https://github.com/miniLV/github_images_miniLV/tree/master/juejin/168a2d80147f8435?raw=true)

<br>

---


## 集成方法

1.CocoaPods : `pod 'MNFloatBtn'`

2.手动导入 : 拖入`MNFloatBtn`文件夹 

## 使用方法
1. 导入头文件,`#import <MNFloatBtn/MNFloatBtn.h>`
2. 一行代码,显示悬浮按钮

---
- 任何情况都显示悬浮按钮
```
[MNFloatBtn show];
```
<br>

- 仅在Debug模式下显示悬浮按钮(推荐使用)
```
[MNFloatBtn showDebugModeWithType:MNAssistiveTypeNone];
```
<br>

- 移除悬浮按钮在界面上显示
```
[MNFloatBtn hidden];
```

- 按钮点击事件

``` 
[MNFloatBtn sharedBtn].btnClick = ^(UIButton *sender) {

    NSLog(@" btn.btnClick ~");
    
};
```

---

## 进阶用法:

- 默认显示当前日期
```
[[MNFloatBtn sharedBtn] setBuildShowDate:YES];
```

- 配置api环境显示

```

#define kAddress            @"testapi.miniLV.com"
//#define kAddress            @"devapi.miniLV.com"
//#define kAddress            @"api.miniLV.com"
    
//自己配置 - 什么api环境下，要显示什么标签
NSDictionary *envMap = @{
                         @"测试":@"testapi.miniLV.com",
                         @"开发":@"devapi.miniLV.com",
                         @"生产":@"api.miniLV.com"
                         };
                             
//设置不同环境下，要展示的不同title，以及当前的Host
[[MNFloatBtn sharedBtn]setEnvironmentMap:envMap currentEnv:kAddress]; 
    
```

<br>

[demo地址](https://github.com/miniLV/MNFloatBtn)

---

*喜欢的可以给个star，不胜感激~*
