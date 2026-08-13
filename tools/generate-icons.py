#!/usr/bin/env python3
import math
import os
import struct
import zlib

OUT_DIR='icons'
SIZES=(16,32,48,128)
BG=(5,9,13,255)
EDGE=(55,148,255,255)
CYAN=(79,193,255,255)
GREEN=(78,201,176,255)
INK=(220,231,241,255)


def blend(dst,src,a):
    return tuple(round(dst[i]*(1-a)+src[i]*a) for i in range(4))


def png_write(path,w,h,pixels):
    def chunk(tag,data):
        return struct.pack('>I',len(data))+tag+data+struct.pack('>I',zlib.crc32(tag+data)&0xffffffff)
    raw=b''.join(b'\x00'+bytes(pixels[y*w:(y+1)*w]) for y in range(h))
    sig=b'\x89PNG\r\n\x1a\n'
    ihdr=struct.pack('>IIBBBBB',w,h,8,6,0,0,0)
    with open(path,'wb') as f:
        f.write(sig+chunk(b'IHDR',ihdr)+chunk(b'IDAT',zlib.compress(raw,9))+chunk(b'IEND',b''))


def render(size):
    scale=4
    w=h=size*scale
    px=[0]*(w*h*4)
    r=0.22*w
    cx=cy=w/2

    def setp(x,y,color,a=1.0):
        if x<0 or y<0 or x>=w or y>=h:return
        idx=(y*w+x)*4
        old=tuple(px[idx:idx+4])
        if old==(0,0,0,0): old=(0,0,0,0)
        c=blend(old,color,a)
        px[idx:idx+4]=c

    # rounded dark tile
    for y in range(h):
        for x in range(w):
            dx=max(abs(x-cx)-(w/2-r),0)
            dy=max(abs(y-cy)-(h/2-r),0)
            inside=dx*dx+dy*dy<=r*r
            if inside:setp(x,y,BG)

    # cyan/blue perimeter inset
    inset=0.09*w
    rr=r*0.78
    for y in range(h):
        for x in range(w):
            def rounded_inside(off):
                ww=w-2*off; hh=h-2*off; rc=max(1,rr-off*0.15)
                ccx=w/2; ccy=h/2
                dx=max(abs(x-ccx)-(ww/2-rc),0)
                dy=max(abs(y-ccy)-(hh/2-rc),0)
                return dx*dx+dy*dy<=rc*rc and off<=x<w-off and off<=y<h-off
            outer=rounded_inside(inset)
            inner=rounded_inside(inset+max(1,0.018*w))
            if outer and not inner:setp(x,y,EDGE,0.78)

    # N monogram, drawn as thick capsules
    def capsule(x1,y1,x2,y2,width,color):
        vx=x2-x1; vy=y2-y1; l2=vx*vx+vy*vy or 1
        minx=max(0,int(min(x1,x2)-width)); maxx=min(w-1,int(max(x1,x2)+width))
        miny=max(0,int(min(y1,y2)-width)); maxy=min(h-1,int(max(y1,y2)+width))
        rad=width/2
        for yy in range(miny,maxy+1):
            for xx in range(minx,maxx+1):
                t=max(0,min(1,((xx-x1)*vx+(yy-y1)*vy)/l2))
                qx=x1+t*vx; qy=y1+t*vy
                d=math.hypot(xx-qx,yy-qy)
                if d<=rad:
                    a=min(1,max(0,rad+0.8-d))
                    setp(xx,yy,color,a)
    left=0.30*w; right=0.70*w; top=0.27*w; bottom=0.73*w; sw=0.105*w
    capsule(left,bottom,left,top,sw,CYAN)
    capsule(left,top,right,bottom,sw,INK)
    capsule(right,bottom,right,top,sw,CYAN)

    # small green runtime indicator
    rr2=0.055*w; gx=0.72*w; gy=0.25*w
    for y in range(int(gy-rr2-2),int(gy+rr2+2)):
        for x in range(int(gx-rr2-2),int(gx+rr2+2)):
            d=math.hypot(x-gx,y-gy)
            if d<=rr2:setp(x,y,GREEN,min(1,rr2+0.8-d))

    # downsample 4x with box average
    out=[]
    for oy in range(size):
        for ox in range(size):
            vals=[0,0,0,0]
            for sy in range(scale):
                for sx in range(scale):
                    idx=((oy*scale+sy)*w+(ox*scale+sx))*4
                    for c in range(4):vals[c]+=px[idx+c]
            out.extend(round(v/(scale*scale)) for v in vals)
    return out


os.makedirs(OUT_DIR,exist_ok=True)
for size in SIZES:
    path=os.path.join(OUT_DIR,f'icon-{size}.png')
    png_write(path,size,size,render(size))
    print(path)
