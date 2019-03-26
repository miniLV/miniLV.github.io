//
//  ViewController.m
//  Runtime-TriedResolverDemo
//
//  Created by 梁宇航 on 2019/3/17.
//  Copyright © 2019年 梁宇航. All rights reserved.
//

#import "ViewController.h"
#import "IOSer.h"
#import "Forwarding.h"
@interface ViewController ()

@end


@implementation ViewController

- (void)viewDidLoad {
    [super viewDidLoad];

    //动态方法解析
//    IOSer *ios = [[IOSer alloc]init];
//    [ios interview];
//
    //消息转发
    Forwarding *obj = [[Forwarding alloc]init];
    [obj interview];
}




@end
