---
layout:     post
title:      "UITableView性能优化-中级篇"
subtitle:   "cell的懒加载 && runloop && YYWebImage使用"
date:       2018-06-29 12:00:00
author:     "miniLV"
header-img: "img/ios_tableview_banner.png"
tags:
    - 性能优化
---


老实说，*UITableView性能优化* 这个话题，最经常遇到的还是在面试中，常见的回答例如:
- Cell复用机制
- Cell高度预先计算
- 缓存Cell高度
- 圆角切割
- 等等. . .

![made in 小蠢驴的配图](https://github.com/miniLV/github_images_miniLV/blob/master/juejin/167b5cc0199f4aa3?raw=true)
### 进阶篇
最近遇到一个需求，对`tableView`有中级优化需求
1. 要求 `tableView` 滚动的时候,滚动到哪行，哪行的图片才加载并显示,滚动过程中图片不加载显示;
2. 页面跳转的时候，取消当前页面的图片加载请求；

以最常见的cell加载webImage为例:
```
- (UITableViewCell *)tableView:(UITableView *)tableView cellForRowAtIndexPath:(NSIndexPath *)indexPath{
    
    UITableViewCell *cell = [tableView dequeueReusableCellWithIdentifier:@"cell"];
    if (!cell) {
        cell = [[UITableViewCell alloc]initWithStyle:UITableViewCellStyleDefault reuseIdentifier:@"cell"];
    }
    
    DemoModel *model = self.datas[indexPath.row];
    cell.textLabel.text = model.text;
   
    [cell.imageView setYy_imageURL:[NSURL URLWithString:model.user.avatar_large]];
    
    return cell;
}
```

#### 解释下cell的复用机制:
- 如果`cell`没进入到界面中(还不可见)，不会调用`- (UITableViewCell *)tableView:(UITableView *)tableView cellForRowAtIndexPath:(NSIndexPath *)indexPath`去渲染cell,在cell中如果设置`loadImage`，不会调用;
- 而当`cell`进去界面中的时候，再进行cell渲染(无论是init还是从复用池中取)
<br>

#### 解释下YYWebImage机制:
- 内部的`YYCache`会对图片进行数据缓存，以`key`:`value`的形式，这里的`key = imageUrl`，`value = 下载的image图片`
- 读取的时候判断`YYCache`中是否有该url，有的话，直接读取缓存图片数据，没有的话，走图片下载逻辑，并缓存图片

<br>

#### 问题所在:
如上设置，如果我们cell一行有20行，页面启动的时候，直接滑动到最底部，20个cell都进入过了界面，`- (UITableViewCell *)tableView:(UITableView *)tableView cellForRowAtIndexPath:(NSIndexPath *)indexPath` 被调用了20次，不符合 `需求1`的要求

解决思路:
1. `cell` 每次被渲染时，先判断当前 `tableView` 是否处于滚动状态，如果正在滚动，就先不加载图片。
2. 滚动结束后，拿到当前界面内所有可见的 `cell`。
3. 基于可见 `cell` 再统一触发图片请求和显示。

步骤 1：在 `cellForRowAtIndexPath:` 中根据滚动状态决定是否触发图片加载。

```objc
- (UITableViewCell *)tableView:(UITableView *)tableView cellForRowAtIndexPath:(NSIndexPath *)indexPath {
    
    UITableViewCell *cell = [tableView dequeueReusableCellWithIdentifier:@"cell"];
    if (!cell) {
        cell = [[UITableViewCell alloc] initWithStyle:UITableViewCellStyleDefault reuseIdentifier:@"cell"];
    }
    
    DemoModel *model = self.datas[indexPath.row];
    cell.textLabel.text = model.text;
   
    // 不再直接让 cell.imageView 使用 YYWebImage 加载
    if (model.iconImage) {
        cell.imageView.image = model.iconImage;
    } else {
        cell.imageView.image = [UIImage imageNamed:@"placeholder"];
        
        // 核心判断：tableView 非滚动状态下，才进行图片下载和渲染
        if (!tableView.dragging && !tableView.decelerating) {
            [ImageDownload loadImageWithModel:model success:^{
                dispatch_async(dispatch_get_main_queue(), ^{
                    cell.imageView.image = model.iconImage;
                });
            }];
        }
    }
    
    return cell;
}
```

步骤 2：滚动结束后，拿到当前页面内所有可见的 `cell`，再补发图片请求。

```objc
- (void)p_loadImage {

    // 拿到当前界面内所有可见 cell 的 indexPath
    NSArray *visibleCellIndexPaths = self.tableView.indexPathsForVisibleRows;

    for (NSIndexPath *indexPath in visibleCellIndexPaths) {

        DemoModel *model = self.datas[indexPath.row];

        if (model.iconImage) {
            continue;
        }

        UITableViewCell *cell = [self.tableView cellForRowAtIndexPath:indexPath];

        [ImageDownload loadImageWithModel:model success:^{
            dispatch_async(dispatch_get_main_queue(), ^{
                cell.imageView.image = model.iconImage;
            });
        }];
    }
}
```

步骤 3：在滚动代理方法里统一触发 `p_loadImage`。

```objc
// 手一直在拖拽控件
- (void)scrollViewDidEndDecelerating:(UIScrollView *)scrollView {

    [self p_loadImage];
}

// 手已经松开，判断是否还会继续减速滚动
- (void)scrollViewDidEndDragging:(UIScrollView *)scrollView willDecelerate:(BOOL)decelerate {

    if (!decelerate) {
        // 直接停止，没有惯性滚动
        [self p_loadImage];
    } else {
        // 仍有惯性滚动，会在 scrollViewDidEndDecelerating: 中处理
    }
}
```

> `dragging`: `returns YES if user has started scrolling. this may require some time and or distance to move to initiate dragging`
可以理解为，用户正在拖拽当前视图滚动，也就是手还没有离开屏幕。

> `decelerating`: `returns YES if user isn't dragging (touch up) but scroll view is still moving`
可以理解为，用户手已经放开，但视图仍然在滚动，也就是惯性滚动阶段。

##### ScrollView一次拖拽的代理方法执行流程:
![ScrollView flow diagram]({{ '/assets/images/tableview-scrollview-flow.png' | relative_url }})



当前代码生效的效果如下:
![demo.gif](https://github.com/miniLV/github_images_miniLV/blob/master/juejin/167b5cc01a628414?raw=true)


#### RunLoop 方案
```objc
- (UITableViewCell *)tableView:(UITableView *)tableView cellForRowAtIndexPath:(NSIndexPath *)indexPath {
    
    UITableViewCell *cell = [tableView dequeueReusableCellWithIdentifier:@"cell"];
    if (!cell) {
        cell = [[UITableViewCell alloc] initWithStyle:UITableViewCellStyleDefault reuseIdentifier:@"cell"];
    }
    
    DemoModel *model = self.datas[indexPath.row];
    cell.textLabel.text = model.text;
    
    if (model.iconImage) {
        cell.imageView.image = model.iconImage;
    } else {
        cell.imageView.image = [UIImage imageNamed:@"placeholder"];

        /**
         RunLoop 在滚动时会进入 UITrackingRunLoopMode，
         默认状态下执行的是 NSDefaultRunLoopMode。
         因此把任务放进 NSDefaultRunLoopMode 后，滚动期间会暂停，
         停止滚动后再继续执行。
         */
        [self performSelector:@selector(p_loadImgeWithIndexPath:)
                   withObject:indexPath
                   afterDelay:0.0
                      inModes:@[NSDefaultRunLoopMode]];
    }

    return cell;
}

// 下载图片，并渲染到 cell 上显示
- (void)p_loadImgeWithIndexPath:(NSIndexPath *)indexPath {
    
    DemoModel *model = self.datas[indexPath.row];
    UITableViewCell *cell = [self.tableView cellForRowAtIndexPath:indexPath];
    
    [ImageDownload loadImageWithModel:model success:^{
        dispatch_async(dispatch_get_main_queue(), ^{
            cell.imageView.image = model.iconImage;
        });
    }];
}
```
效果与`demo.gif`的效果一致

> RunLoop 两种常见模式：
> - 默认状态下是 `NSDefaultRunLoopMode`
> - 滚动过程中会切换到 `UITrackingRunLoopMode`
> - 因此放在 `NSDefaultRunLoopMode` 中的任务，会在滚动期间暂停，在停止滚动后继续执行

不过这里有一个明显问题：如果使用 RunLoop，滚动期间虽然不会执行 `NSDefaultRunLoopMode` 下的任务，但滚动一结束，之前积压的 `p_loadImgeWithIndexPath` 会被统一触发，最终效果会很接近 `YYWebImage` 默认行为，依然不满足需求。

会被重新触发的代码如下：
```objc
- (UITableViewCell *)tableView:(UITableView *)tableView cellForRowAtIndexPath:(NSIndexPath *)indexPath {
    
    // p_loadImgeWithIndexPath 一进入 NSDefaultRunLoopMode 就会执行
    [self performSelector:@selector(p_loadImgeWithIndexPath:)
               withObject:indexPath
               afterDelay:0.0
                  inModes:@[NSDefaultRunLoopMode]];
}
```

![runloopDemo.gif](https://github.com/miniLV/github_images_miniLV/blob/master/juejin/167b5cc01a9b8e2f?raw=true)
> 效果如上
> - 滚动的时候不加载图片,滚动结束加载图片-满足
> - 滚动结束，之前滚动过程中的`cell`会加载图片 => 不满足需求

<br>

#### 版本回滚到Runloop之前 - `git reset --hard runloop之前`

*解决: 需求2. 页面跳转的时候，取消当前页面的图片加载请求；*

```

- (void)p_loadImgeWithIndexPath:(NSIndexPath *)indexPath{
    
    DemoModel *model = self.datas[indexPath.row];
    
    //保存当前正在下载的操作
    ImageDownload *manager = self.imageLoadDic[indexPath];
    if (!manager) {
        
        manager = [ImageDownload new];
        //开始加载-保存到当前下载操作字典中
        [self.imageLoadDic setObject:manager forKey:indexPath];
    }
    
    [manager loadImageWithModel:model success:^{
        //主线程刷新UI
        dispatch_async(dispatch_get_main_queue(), ^{
            UITableViewCell *cell = [self.tableView cellForRowAtIndexPath:indexPath];
            cell.imageView.image = model.iconImage;
        });
        
        //加载成功-从保存的当前下载操作字典中移除
        [self.imageLoadDic removeObjectForKey:indexPath];
    }];
}

- (void)viewWillDisappear:(BOOL)animated{
    [super viewWillDisappear:animated];
  
    NSArray *loadImageManagers = [self.imageLoadDic allValues];
    //当前图片下载操作全部取消
    [loadImageManagers makeObjectsPerformSelector:@selector(cancelLoadImage)];
}


@implementation ImageDownload
- (void)cancelLoadImage{
    [_task cancel];
}
@end
```

思路:
1. 创建一个可变字典，以`indexPath`:`manager`的格式，将当前的图片下载操作存起来
2. 每次下载之前，将当前下载线程存入，下载成功后，将该线程移除
3. 在`viewWillDisappear`的时候,取出当前线程字典中的所有线程对象，遍历进行`cancel`操作，完成需求

<br>

### 话外篇:面试题赠送

#### 问：UITableView的圆角性能优化如何实现
答:
1. 让服务器直接传圆角图片；
2. 贝塞尔切割控件layer；
3. `YYWebImage`为例，可以先下载图片，再对图片进行圆角处理，再设置到`cell`上显示

<br>

#### 问：YYWebImage 如何设置圆角? 在下载完成的回调中?如果你在下载完成的时候再切割，此时 YYWebImage 缓存中的图片是初始图片，还是圆角图片?(终于等到3了！！)

答: 如果是下载完，在回调中进行切割圆角的处理，其实缓存的图片是原图，等于每次取的时候，缓存中取出来的都是矩形图片，每次`set`都得做切割操作；

<br>


#### 问: 那是否有解决办法?
答：其实是有的，简单来说`YYWebImage` 可以拆分成两部分，默认情况下，我们拿到的回调，是走了 `download` && `cache`的流程了，这里我们多做一步，取出`cache`中该`url`路径对应的图片，进行圆角切割，再存储到 cache中，就能保证以后每次拿到的就都是`cacha`中已经裁切好的圆角图片

详情可见：
```
NSString *path = [[UIApplication sharedApplication].cachesPath stringByAppendingPathComponent:@"weibo.avatar"];
YYImageCache *cache = [[YYImageCache alloc] initWithPath:path];
manager = [[YYWebImageManager alloc] initWithCache:cache queue:[YYWebImageManager sharedManager].queue];
manager.sharedTransformBlock = ^(UIImage *image, NSURL *url) {
    if (!image) return image;
    return [image imageByRoundCornerRadius:100]; // a large value
};
```

*`SDWebImage`同理，它有暴露了一个方法出来，可以直接设置保存图片到磁盘中，无需修改源码*

[Demo源码](https://github.com/miniLV/TableViewCellOptimization)
<br>
---
*参考资料*

[iOS 保持界面流畅的技巧](https://blog.ibireme.com/2015/11/12/smooth_user_interfaces_for_ios/)

[VVeboTableViewDemo](https://github.com/johnil/VVeboTableViewDemo)

[YYKitDemo](https://github.com/ibireme/YYKit)

[UIScrollView 实践经验](https://tech.glowing.com/cn/practice-in-uiscrollview/)
