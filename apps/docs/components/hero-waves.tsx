'use client';

import { useEffect, useState, type ComponentProps } from 'react';
import PatternWaves from '@/components/PatternWaves';

function hasWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

/** PatternWaves throws without WebGL, so it only mounts when a context can be created. */
export function HeroWaves(props: ComponentProps<typeof PatternWaves>) {
  const [supported, setSupported] = useState(false);
  useEffect(() => setSupported(hasWebGL()), []);
  return supported ? <PatternWaves {...props} /> : null;
}
