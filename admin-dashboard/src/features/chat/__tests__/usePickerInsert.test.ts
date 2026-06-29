import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePickerInsert } from '../usePickerInsert';

function makeTextarea(value: string, selectionStart: number): HTMLTextAreaElement {
  const el = document.createElement('textarea');
  el.value = value;
  el.selectionStart = selectionStart;
  el.selectionEnd = selectionStart;
  document.body.appendChild(el);
  return el;
}

describe('usePickerInsert', () => {
  let el: HTMLTextAreaElement;

  beforeEach(() => {
    el = makeTextarea('', 0);
  });

  it('inserts a token at the caret', () => {
    const ref = { current: el };
    const setInputText = vi.fn();
    const { result } = renderHook(() =>
      usePickerInsert(ref as any, '', setInputText),
    );

    act(() => result.current('😀'));

    expect(setInputText).toHaveBeenCalledWith('😀');
  });

  it('keeps sequential emoji picks in insertion order within the same act block', () => {
    const ref = { current: el };
    const setInputText = vi.fn();
    const { result } = renderHook(() =>
      usePickerInsert(ref as any, '', setInputText),
    );

    act(() => {
      result.current('😀');
      result.current('😂');
    });

    expect(setInputText).toHaveBeenNthCalledWith(1, '😀');
    expect(setInputText).toHaveBeenNthCalledWith(2, '😀😂');
    expect(el.value).toBe('😀😂');
    expect(el.selectionStart).toBe('😀😂'.length);
    expect(el.selectionEnd).toBe('😀😂'.length);
  });

  it('advances the textarea value and caret between rapid inserts', () => {
    const ref = { current: el };
    const setInputText = vi.fn();
    const { result } = renderHook(() =>
      usePickerInsert(ref as any, '', setInputText),
    );

    act(() => {
      result.current('😀');
      result.current('😂');
    });

    expect(setInputText).toHaveBeenNthCalledWith(1, '😀');
    expect(setInputText).toHaveBeenNthCalledWith(2, '😀😂');
    expect(el.value).toBe('😀😂');
    expect(el.selectionStart).toBe('😀😂'.length);
    expect(el.selectionEnd).toBe('😀😂'.length);
  });

  it('inserts at a mid-string caret position', () => {
    el.value = 'hello world';
    el.selectionStart = 5;
    el.selectionEnd = 5;

    const ref = { current: el };
    const setInputText = vi.fn();
    const { result } = renderHook(() =>
      usePickerInsert(ref as any, 'hello world', setInputText),
    );

    act(() => result.current('!'));

    expect(setInputText).toHaveBeenCalledWith('hello! world');
  });

  it('replaces selected text', () => {
    el.value = 'hello world';
    el.selectionStart = 0;
    el.selectionEnd = 5;

    const ref = { current: el };
    const setInputText = vi.fn();
    const { result } = renderHook(() =>
      usePickerInsert(ref as any, 'hello world', setInputText),
    );

    act(() => result.current('bye'));

    expect(setInputText).toHaveBeenCalledWith('bye world');
  });

  it('clamps result to 255 characters', () => {
    const long = 'a'.repeat(254);
    el.value = long;
    el.selectionStart = 254;
    el.selectionEnd = 254;

    const ref = { current: el };
    const setInputText = vi.fn();
    const { result } = renderHook(() =>
      usePickerInsert(ref as any, long, setInputText),
    );

    act(() => result.current('XYZ'));

    const called = setInputText.mock.calls[0][0] as string;
    expect(called.length).toBe(255);
    expect(called.endsWith('X')).toBe(true);
  });
});
