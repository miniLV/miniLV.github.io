---
layout:     post
title:      "UITableView性能优化-中级篇"
subtitle:   "cell的懒加载 && runloop && YYWebImage使用"
date:       2018-06-29 12:00:00
author:     "miniLV"
header-img: "img/post-bg-2015.jpg"
tags:
    - 性能优化
---


老实说，*UITableView性能优化* 这个话题，最经常遇到的还是在面试中，常见的回答例如:
- Cell复用机制
- Cell高度预先计算
- 缓存Cell高度
- 圆角切割
- 等等. . .

![made in 小蠢驴的配图](https://github.com/miniLV/github_images_miniLV/tree/master/juejin/167b5cc0199f4aa3?raw=true)
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

解决办法:
1. `cell`每次被渲染时，判断当前`tableView`是否处于滚动状态，是的话，不加载图片；
2. `cell` 滚动结束的时候，获取当前界面内可见的所有`cell`
3. 在`2`的基础之上，让所有的`cell`请求图片数据，并显示出来

- 步骤1:
```
- (UITableViewCell *)tableView:(UITableView *)tableView cellForRowAtIndexPath:(NSIndexPath *)indexPath{
    
    UITableViewCell *cell = [tableView dequeueReusableCellWithIdentifier:@"cell"];
    if (!cell) {
        cell = [[UITableViewCell alloc]initWithStyle:UITableViewCellStyleDefault reuseIdentifier:@"cell"];
    }
    
    DemoModel *model = self.datas[indexPath.row];
    cell.textLabel.text = model.text;
   
    //不在直接让cell.imageView loadYYWebImage
    if (model.iconImage) {
        cell.imageView.image = model.iconImage;
    }else{
        cell.imageView.image = [UIImage imageNamed:@"placeholder"];
        
        //核心判断：tableView非滚动状态下，才进行图片下载并渲染
        if (!tableView.dragging && !tableView.decelerating) {
            //下载图片数据 - 并缓存
            [ImageDownload loadImageWithModel:model success:^{
                
                //主线程刷新UI
                dispatch_async(dispatch_get_main_queue(), ^{
                    cell.imageView.image = model.iconImage;
                });
            }];
        }
}
```
- 步骤2:
```
- (void)p_loadImage{

    //拿到界面内-所有的cell的indexpath
    NSArray *visableCellIndexPaths = self.tableView.indexPathsForVisibleRows;

    for (NSIndexPath *indexPath in visableCellIndexPaths) {

        DemoModel *model = self.datas[indexPath.row];

        if (model.iconImage) {
            continue;
        }

        UITableViewCell *cell = [self.tableView cellForRowAtIndexPath:indexPath];

        [ImageDownload loadImageWithModel:model success:^{
            //主线程刷新UI
            dispatch_async(dispatch_get_main_queue(), ^{
 
                cell.imageView.image = model.iconImage;
            });
        }];
    }
}
```
- 步骤3:

```
//手一直在拖拽控件
- (void)scrollViewDidEndDecelerating:(UIScrollView *)scrollView{

    [self p_loadImage];
}

//手放开了-使用惯性-产生的动画效果
- (void)scrollViewDidEndDragging:(UIScrollView *)scrollView willDecelerate:(BOOL)decelerate{

    if(!decelerate){
        //直接停止-无动画
        [self p_loadImage];
    }else{
        //有惯性的-会走`scrollViewDidEndDecelerating`方法，这里不用设置
    }
}
```
> `dragging`:`returns YES if user has started scrolling. this may require some time and or distance to move to initiate dragging`
可以理解为，用户在拖拽当前视图滚动(手一直拉着)

> `deceleratingreturns`:`returns YES if user isn't dragging (touch up) but scroll view is still moving`
可以理解为用户手已放开，试图是否还在滚动(是否惯性效果)

##### ScrollView一次拖拽的代理方法执行流程:
![ScrollView流程图.png](https://github.com/miniLV/github_images_miniLV/tree/master/juejin/167b5cc01a0084b9?raw=true)



当前代码生效的效果如下:
![demo.gif](https://github.com/miniLV/github_images_miniLV/tree/master/juejin/167b5cc01a628414?raw=true)


#### RunLoop小操作
```
- (UITableViewCell *)tableView:(UITableView *)tableView cellForRowAtIndexPath:(NSIndexPath *)indexPath{
    
    UITableViewCell *cell = [tableView dequeueReusableCellWithIdentifier:@"cell"];
    if (!cell) {
        cell = [[UITableViewCell alloc]initWithStyle:UITableViewCellStyleDefault reuseIdentifier:@"cell"];
    }
    
    DemoModel *model = self.datas[indexPath.row];
    cell.textLabel.text = model.text;
   
    
    if (model.iconImage) {
        cell.imageView.image = model.iconImage;
    }else{
        cell.imageView.image = [UIImage imageNamed:@"placeholder"];

        /**
         runloop - 滚动时候 - trackingMode，
         - 默认情况 - defaultRunLoopMode
         ==> 滚动的时候，进入`trackingMode`，defaultMode下的任务会暂停
         停止滚动的时候 - 进入`defaultMode` - 继续执行`trackingMode`下的任务 - 例如这里的loadImage
         */
        [self performSelector:@selector(p_loadImgeWithIndexPath:)
                   withObject:indexPath
                   afterDelay:0.0
                      inModes:@[NSDefaultRunLoopMode]];
}

//下载图片，并渲染到cell上显示
- (void)p_loadImgeWithIndexPath:(NSIndexPath *)indexPath{
    
    DemoModel *model = self.datas[indexPath.row];
    UITableViewCell *cell = [self.tableView cellForRowAtIndexPath:indexPath];
    
    [ImageDownload loadImageWithModel:model success:^{
        //主线程刷新UI
        dispatch_async(dispatch_get_main_queue(), ^{
            cell.imageView.image = model.iconImage;
        });
    }];
}
```
效果与`demo.gif`的效果一致

> runloop - 两种常用模式介绍:   `trackingMode` && `defaultRunLoopMode`
> - 默认情况 - defaultRunLoopMode
> - 滚动时候 - trackingMode
> - 滚动的时候，进入`trackingMode`,导致`defaultMode`下的任务会被暂停,停止滚动的时候 ==> 进入`defaultMode` - 继续执行`defaultMode`下的任务 - 例如这里的`defaultMode`

> 大tips:这里，如果使用RunLoop，滚动的时候虽然不执行`defaultMode`，但是滚动一结束，之前cell中的`p_loadImgeWithIndexPath`就会全部再被调用，导致类似`YYWebImage`的效果，其实也是不满足需求,
- 提示会被调用的代码如下:
```
- (UITableViewCell *)tableView:(UITableView *)tableView cellForRowAtIndexPath:(NSIndexPath *)indexPath{
    
    //p_loadImgeWithIndexPath一进入`NSDefaultRunLoopMode`就会执行
    [self performSelector:@selector(p_loadImgeWithIndexPath:)
               withObject:indexPath
               afterDelay:0.0
                  inModes:@[NSDefaultRunLoopMode]];
}
```

![runloopDemo.gif](https://github.com/miniLV/github_images_miniLV/tree/master/juejin/167b5cc01a9b8e2f?raw=true)
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
*最近网上各种互联网公司裁员信息铺天盖地，甚至包括各种一线公司 ( X东 X乎 都扛不住了吗-。-)iOS本来就是提前进入寒冬，iOS小白们可以尝试思考下这个问题*

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

>“winner is coming”,如果面试正好遇到以上问题的，请叫我雷锋~
衷心希望各位iOS小伙伴门能熬过这个冬天？

<br>

[Demo源码](https://github.com/miniLV/TableViewCellOptimization)
<br>
---
*参考资料*

[iOS 保持界面流畅的技巧](https://blog.ibireme.com/2015/11/12/smooth_user_interfaces_for_ios/)

[VVeboTableViewDemo](https://github.com/johnil/VVeboTableViewDemo)

[YYKitDemo](https://github.com/ibireme/YYKit)

[UIScrollView 实践经验](https://tech.glowing.com/cn/practice-in-uiscrollview/)
