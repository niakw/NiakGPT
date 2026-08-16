#!/usr/bin/env python3
"""Lifecycle debug runner using the exact 0.9.53 production load order."""
import lifecycle_debug_0953 as base

_original_read=base.read

def production_read(name):
    if name=='multitab-v090.js':
        return _original_read('browser-compat-v102.js')+'\n'+_original_read(name)
    return _original_read(name)

base.read=production_read

if __name__=='__main__':
    base.main()
