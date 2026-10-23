import assert from 'node:assert/strict';
import { setTimeout } from 'node:timers/promises';
const task = process.argv[2];
switch (task) {
  case 'greet':
    console.log(`Hello, ${process.env.PERSON}${process.env.EXCITED === 'true' ? '!' : '.'}`);
    break;
  case 'lint':
    console.log('Checking demo source…');
    await setTimeout(150);
    console.log('Source looks good.');
    break;
  case 'test':
    assert.equal(2 + 2, 4);
    await setTimeout(200);
    console.log('Demo assertion passed.');
    break;
  case 'build':
    console.log('Build complete. This demo writes no artifacts.');
    break;
  case 'probe': {
    const response = await fetch('http://127.0.0.1:4317/health');
    assert.equal(response.status, 200);
    console.log(`Server says: ${await response.text()}`);
    break;
  }
  default:
    throw new Error(`Unknown demo task: ${task}`);
}
