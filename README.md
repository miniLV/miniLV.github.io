# Hux Blog模板小学生翻译(人人看得懂系列)


---
### 使用说明

#### 1. clone 或者 fork 该仓库

```
git clone https://github.com/miniLV/miniLV.github.io
```

#### 2. 替换成你自己的github.io仓库,建立新的关联

```
//直接修改
git remote set-url origin [url]

```

```
//实际操作
git remote set-url origin https://github.com/miniLV/miniLV.github.io

```

> https://github.com/miniLV/miniLV.github.io 替换成你的仓库即可

**[在这里预览模板 &rarr;](http://minilv.github.io)**

#### 3. 具体配置

你可以通用修改 `_config.yml`文件来轻松的开始搭建自己的博客:

```
# Site settings
title: Hux Blog             # 你的博客网站标题
SEOTitle: Hux Blog			# 在后面会详细谈到
description: "Cool Blog"    # 随便说点，描述一下

url: "https://github.com/miniLV/miniLV.github.io" # 特别要讲这个，直接用仓库路径
baseurl: "/"         # 特别要讲这个，直接用当前目录路径 - “/”


# SNS settings    
github_username: miniLV     # 你的github账号  
juejin_username: 5a0a82ac6fb9a04515436530 #掘金账号
jianshu_username: eb8d9cad0ff2 #简书账号

weibo_username: huxpro      # 你的微博账号，底部链接会自动更新的。

# Build settings
# paginate: 10              # 一页你准备放几篇文章
```

## 支持

* 你可以自由的fork。如果你能将主题作者和 github 的地址保留在你的页面底部，他将非常感谢你。
* 如果你喜欢我的这个简化版博客模板，请在`miniLV.github.io`这个repository点个赞——右上角**star**一下。
* 如果你喜欢作者fork的这个博客模板，请在`huxpro.github.io`这个repository点个赞——右上角**star**一下。

#### Environment

如果你安装了jekyll，那你只需要在命令行输入`jekyll serve`就能在本地浏览器预览主题。你还可以输入`jekyll serve --watch`，这样可以边修改边自动运行修改后的文件。

特别提醒: 推送到远程，只要一个push操作即可，然后检查`branch` 中 `master` 的状态(踩了大坑，囧！)

![WX20190131-111113.png](https://upload-images.jianshu.io/upload_images/4563271-61b49260c39c1774.png?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)

看到这种状态，说明你的个人网站已经部署到服务器成功~ 请在浏览器中输入具体url测试下~

<br>

---

### 优化点
- 解决了原模板中，直接push无法编译通过的bug
- 添加了简书 && 掘金的入口
- 隐藏了 “关于我” 的入口，适合像我这种小白暂时没什么拿得出手的东西，暂时关闭
- 解决了原模板中，`Font Awesome` 无法显示的问题(图标无法显示-只能看到一个“知乎”的“知”字)


#### Tips
 原模板中的几个坑都踩完了，目测当前仓库可以直接使用，如有问题，请联系 [miniLV](https://github.com/miniLV),如果他不能解决，请联系[Hux](https://github.com/Huxpro)!!

---


*This is the boilerplate of [Hux Blog](https://github.com/Huxpro/huxpro.github.io), all documents is over there! Thinks Hux ~*
