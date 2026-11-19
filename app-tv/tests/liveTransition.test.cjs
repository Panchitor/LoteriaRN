const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../src/screens/PlayerScreen.tsx'), 'utf8');

test('local playback continues until the live fade has completed', () => {
  assert.match(source, /shouldPlay=\{!isLiveTransitionComplete\}/);
  assert.match(source, /isMuted=\{isLiveTransitionComplete\}/);
});

test('live audio remains muted until the transition has completed', () => {
  assert.match(source, /isMuted=\{!isLiveTransitionComplete\}/);
  assert.match(source, /if \(finished\) setIsLiveTransitionComplete\(true\)/);
});
