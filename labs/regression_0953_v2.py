#!/usr/bin/env python3
"""0.9.53 regression matrix using the exact production runtime ordering.

Historical regression_0953.py is intentionally preserved. This wrapper prepends the
browser compatibility guard when the historical lab directly injects multitab-v090.js,
matching background-v100.js where browser-compat-v102.js is loaded immediately before
multitab-v090.js.
"""
import regression_0953 as base

_original_read=base.read

def production_read(name):
    if name=='multitab-v090.js':
        return _original_read('browser-compat-v102.js')+'\n'+_original_read(name)
    return _original_read(name)

base.read=production_read

if __name__=='__main__':
    base.main()
