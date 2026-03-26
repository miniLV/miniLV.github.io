---
layout:     post
title:      "iOS：添加一个全局悬浮按钮"
subtitle:   "使用 CocoaPods 集成悬浮调试按钮"
summary:    "本文实现一个可全局显示、可拖动的 iOS 悬浮按钮，用于在测试或开发环境中快速展示当前包体的环境、版本和 Build 信息。"
date:       2019-01-30 16:00:00
author:     "miniLV"
header-img: "img/ios_floatbtn_banner.png"
tags:
    - 工具
---

在多设备测试和联调场景里，最常见的问题不是“有没有问题”，而是“当前这台设备跑的到底是哪一个包”。如果不能快速确认包体对应的环境、版本和 Build 信息，排查过程就很容易绕远路。

![made in 小蠢驴的配图](https://github.com/miniLV/github_images_miniLV/blob/master/juejin/168a2d6d5de66c8d?raw=true)

这篇文章要解决的就是这个问题：做一个全局悬浮按钮，在应用任意页面都能直接看到当前环境，并按需补充版本号和 Build 信息。

<br>

![需求设计图.png](https://github.com/miniLV/github_images_miniLV/blob/master/juejin/168a3021b7941302?raw=true)

#### 思路：
- 既然需要全局展示，就应该把控件加在最上层，也就是 `UIWindow` 上。
- 需求里既有文字也有背景图，用 `UIButton` 来承载会更直接。
- 按钮会遮挡部分界面内容，因此必须支持拖动，交互上可以通过手势来处理。
- 整体实现并不复杂，本质上就是创建一个可拖拽的 `UIButton`，再把它挂到 `UIWindow` 上。

---

<br>

#### 知识1：按钮显示 2 行文字
```
// UIButton 支持多行标题显示
button.titleLabel.lineBreakMode = NSLineBreakByWordWrapping;

// title 中插入 "\n" 即可换行
title = @"123\n666";
```

#### 知识2：获取 Version 和 Build 号
```
NSString *versionStr = [[[NSBundle
       mainBundle]infoDictionary]valueForKey:@"CFBundleShortVersionString"];
NSString *buildStr = [[[NSBundle
       mainBundle]infoDictionary]valueForKey:@"CFBundleVersion"];
```
![image.png](https://github.com/miniLV/github_images_miniLV/blob/master/juejin/168a2d6d5e1e9cdc?raw=true)

#### 知识3：拖动的本质是更新 `frame.origin`
```
// 拖动时更新控件的 x 坐标
- (CGRect)changeXWithFrame:(CGRect)originalFrame point:(CGPoint)point{
    BOOL q1 = originalFrame.origin.x >= 0;
    BOOL q2 = originalFrame.origin.x + originalFrame.size.width <= screenW;
    
    if (q1 && q2) {
        originalFrame.origin.x += point.x;
    }
    return originalFrame;
}

// 拖动时更新控件的 y 坐标
- (CGRect)changeYWithFrame:(CGRect)originalFrame point:(CGPoint)point{
    
    BOOL q1 = originalFrame.origin.y >= 0;
    BOOL q2 = originalFrame.origin.y + originalFrame.size.height <= screenH;
    if (q1 && q2) {
        originalFrame.origin.y += point.y;
    }
    return originalFrame;
}
```

#### 知识4：越界处理与回弹
```
// 记录按钮是否越界
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
            // 如果越界，则回弹到可见区域
            [UIView animateWithDuration:0.3 animations:^{
                self.frame = frame;
            }];
        }
```

#### 知识5：支持不同方向的拖动限制
```
MNAssistiveTouchTypeNone = 0,         // 不限制方向，可自由拖动
MNAssistiveTouchTypeVerticalScroll,   // 只能垂直移动
MNAssistiveTouchTypeHorizontalScroll, // 只能水平移动
```

```
  switch (type) {
        case MNAssistiveTouchTypeNone:
        {
            水平方向坐标 ++；
            竖直方向坐标 ++；
            break;
        }case MNAssistiveTouchTypeHorizontalScroll:{
            水平方向坐标 ++；
            break;
        }
        case MNAssistiveTouchTypeVerticalScroll:{
            竖直方向坐标 ++；
            break;
        }
    }
```

#### 最终效果

![demo.gif](https://github.com/miniLV/github_images_miniLV/blob/master/juejin/168a2d80147f8435?raw=true)

<br>

---


## 集成与使用

通过 CocoaPods 引入：

```ruby
pod 'MNFloatBtn'
```

导入头文件后，就可以直接使用：

```objc
#import <MNFloatBtn/MNFloatBtn.h>
```

如果希望悬浮按钮在任何环境下都显示，可以直接调用：

```objc
[MNFloatBtn show];
```

更推荐在 Debug 环境中显示，避免影响线上包：

```objc
[MNFloatBtn showDebugModeWithType:MNAssistiveTypeNone];
```

不再需要时，可以移除悬浮按钮：

```objc
[MNFloatBtn hidden];
```

也可以为按钮补充点击事件：

```objc
[MNFloatBtn sharedBtn].btnClick = ^(UIButton *sender) {

    NSLog(@"btn.btnClick ~");
    
};
```

如果希望按钮上默认展示当前构建日期，可以这样设置：

```objc
[[MNFloatBtn sharedBtn] setBuildShowDate:YES];
```

如果项目区分测试、开发、生产等 API 环境，也可以直接配置环境映射：

```objc
#define kAddress            @"testapi.miniLV.com"
//#define kAddress            @"devapi.miniLV.com"
//#define kAddress            @"api.miniLV.com"
    
// 自定义不同 Host 对应的展示文案
NSDictionary *envMap = @{
                         @"测试":@"testapi.miniLV.com",
                         @"开发":@"devapi.miniLV.com",
                         @"生产":@"api.miniLV.com"
                         };
                             
// 设置当前 Host，并展示对应的环境标识
[[MNFloatBtn sharedBtn]setEnvironmentMap:envMap currentEnv:kAddress]; 
    
```

<br>

[demo地址](https://github.com/miniLV/MNFloatBtn)

---

*喜欢的可以给个star，不胜感激~*
