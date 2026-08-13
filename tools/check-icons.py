#!/usr/bin/env python3
import os
import struct
import sys
import zlib

EXPECTED={16:'icons/icon-16.png',32:'icons/icon-32.png',48:'icons/icon-48.png',128:'icons/icon-128.png'}
SIG=b'\x89PNG\r\n\x1a\n'

def validate(expected_size,path):
    with open(path,'rb') as f:data=f.read()
    if not data.startswith(SIG):raise ValueError(f'{path}: invalid PNG signature')
    pos=8;width=height=None;idat=[]
    while pos+12<=len(data):
        length=struct.unpack('>I',data[pos:pos+4])[0];tag=data[pos+4:pos+8];payload=data[pos+8:pos+8+length]
        crc=struct.unpack('>I',data[pos+8+length:pos+12+length])[0]
        if zlib.crc32(tag+payload)&0xffffffff!=crc:raise ValueError(f'{path}: CRC mismatch in {tag!r}')
        if tag==b'IHDR':
            width,height,depth,color,comp,flt,interlace=struct.unpack('>IIBBBBB',payload)
            if (depth,color,comp,flt,interlace)!=(8,6,0,0,0):raise ValueError(f'{path}: unexpected PNG format')
        elif tag==b'IDAT':idat.append(payload)
        elif tag==b'IEND':break
        pos+=12+length
    if width!=expected_size or height!=expected_size:raise ValueError(f'{path}: expected {expected_size}x{expected_size}, got {width}x{height}')
    raw=zlib.decompress(b''.join(idat))
    expected=height*(1+width*4)
    if len(raw)!=expected:raise ValueError(f'{path}: invalid RGBA scanlines: expected {expected} bytes, got {len(raw)}')
    stride=1+width*4
    for y in range(height):
        filter_type=raw[y*stride]
        if filter_type not in range(5):raise ValueError(f'{path}: invalid filter type {filter_type} at row {y}')
    alpha=raw[4::4]
    if not any(alpha):raise ValueError(f'{path}: fully transparent image')
    print(f'OK {path}: {width}x{height}, {len(data)} bytes')

for size,path in EXPECTED.items():
    if not os.path.exists(path):
        print(f'MISSING {path}',file=sys.stderr);sys.exit(2)
    try:validate(size,path)
    except Exception as e:
        print(f'INVALID {e}',file=sys.stderr);sys.exit(1)
