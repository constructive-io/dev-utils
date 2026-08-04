import { Readable } from 'stream';

import { KEY_CODES, segmentKeys, TerminalKeypress } from '../src/keypress';

describe('segmentKeys', () => {
  it('returns single keys untouched', () => {
    expect(segmentKeys('a')).toEqual(['a']);
    expect(segmentKeys('')).toEqual([]);
  });

  it('splits a coalesced chunk of printable characters', () => {
    expect(segmentKeys('hunter2')).toEqual(['h', 'u', 'n', 't', 'e', 'r', '2']);
  });

  it('keeps CSI sequences whole', () => {
    expect(segmentKeys(`a${KEY_CODES.UP_ARROW}b`)).toEqual(['a', KEY_CODES.UP_ARROW, 'b']);
    expect(segmentKeys(`${KEY_CODES.CTRL_LEFT}${KEY_CODES.DELETE}`)).toEqual([
      KEY_CODES.CTRL_LEFT,
      KEY_CODES.DELETE
    ]);
    expect(segmentKeys(KEY_CODES.SHIFT_ENTER)).toEqual([KEY_CODES.SHIFT_ENTER]);
  });

  it('keeps SS3 and meta sequences whole', () => {
    expect(segmentKeys(`${KEY_CODES.HOME_ALT}x`)).toEqual([KEY_CODES.HOME_ALT, 'x']);
    expect(segmentKeys(`${KEY_CODES.ALT_B}${KEY_CODES.ALT_BACKSPACE}`)).toEqual([
      KEY_CODES.ALT_B,
      KEY_CODES.ALT_BACKSPACE
    ]);
  });

  it('splits by code point so astral characters survive', () => {
    expect(segmentKeys('a🎉b')).toEqual(['a', '🎉', 'b']);
  });
});

describe('TerminalKeypress chunk dispatch', () => {
  const setup = () => {
    const input = new Readable({ read() {} });
    const keypress = new TerminalKeypress(true, input, { exit: jest.fn() as never });
    return { input, keypress };
  };

  it('delivers every key in a coalesced chunk', () => {
    const { input, keypress } = setup();
    const seen: string[] = [];
    for (const char of ['h', 'u', 'n', 't']) keypress.on(char, () => seen.push(char));

    input.emit('data', 'hunt');

    expect(seen).toEqual(['h', 'u', 'n', 't']);
    keypress.destroy();
  });

  it('dispatches a registered multi-character sequence exactly once', () => {
    const { input, keypress } = setup();
    const up = jest.fn();
    keypress.on(KEY_CODES.UP_ARROW, up);

    input.emit('data', KEY_CODES.UP_ARROW);

    expect(up).toHaveBeenCalledTimes(1);
    keypress.destroy();
  });

  it('stops mid-chunk once a handler pauses the keypress', () => {
    const { input, keypress } = setup();
    const seen: string[] = [];
    keypress.on('a', () => {
      seen.push('a');
      keypress.pause();
    });
    keypress.on('b', () => seen.push('b'));

    input.emit('data', 'ab');

    expect(seen).toEqual(['a']);
    keypress.destroy();
  });

  it('exits on ctrl-c arriving inside a larger chunk', () => {
    const input = new Readable({ read() {} });
    const exit = jest.fn();
    const keypress = new TerminalKeypress(true, input, { exit: exit as never });

    input.emit('data', `a${KEY_CODES.CTRL_C}`);

    expect(exit).toHaveBeenCalledWith(0);
    keypress.destroy();
  });
});
