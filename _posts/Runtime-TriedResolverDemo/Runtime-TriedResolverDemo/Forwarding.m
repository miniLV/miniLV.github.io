//
//  Foawarding.m
//  Runtime-TriedResolverDemo
//
//  Created by 梁宇航 on 2019/3/17.
//  Copyright © 2019年 梁宇航. All rights reserved.
//

#import "Forwarding.h"
#import "IOSer.h"

@implementation Forwarding

- (NSMethodSignature *)methodSignatureForSelector:(SEL)aSelector{
    if (aSelector == @selector(interview)) {

        //v16@0:8 = void xxx (self,_cmd)
        return [NSMethodSignature signatureWithObjCTypes:"v16@0:8"];
    }
    return [super methodSignatureForSelector:aSelector];
}

- (void)forwardInvocation:(NSInvocation *)anInvocation{
    anInvocation getArgument: atIndex:
    anInvocation.target
    anInvocation.invoke
    
    [anInvocation invokeWithTarget:[[IOSer alloc]init]];
}

@end
