import { TextDecoder as PolyfillTextDecoder, TextEncoder as PolyfillTextEncoder } from 'text-encoding';
import 'react-native-get-random-values';
import * as ExpoCrypto from 'expo-crypto';

type EventCtor = new (
  type: string,
  eventInitDict?: { bubbles?: boolean; cancelable?: boolean }
) => Event;

type CustomEventCtor = new <T = unknown>(
  type: string,
  eventInitDict?: { detail?: T; bubbles?: boolean; cancelable?: boolean }
) => { detail: T };

const runtime = globalThis as unknown as {
  TextDecoder?: typeof TextDecoder;
  TextEncoder?: typeof TextEncoder;
  crypto?: {
    getRandomValues?: <T extends ArrayBufferView>(array: T) => T;
    randomUUID?: () => string;
  };
  Event?: EventCtor;
  CustomEvent?: CustomEventCtor;
  window?: {
    crypto?: {
      getRandomValues?: <T extends ArrayBufferView>(array: T) => T;
      randomUUID?: () => string;
    };
    Event?: EventCtor;
    CustomEvent?: CustomEventCtor;
    addEventListener?: (type: string, listener: (...args: unknown[]) => void) => void;
    removeEventListener?: (type: string, listener: (...args: unknown[]) => void) => void;
    dispatchEvent?: (event: unknown) => boolean;
  };
  addEventListener?: (type: string, listener: (...args: unknown[]) => void) => void;
  removeEventListener?: (type: string, listener: (...args: unknown[]) => void) => void;
  dispatchEvent?: (event: unknown) => boolean;
};

if (typeof runtime.TextDecoder === 'undefined') {
  runtime.TextDecoder = PolyfillTextDecoder as unknown as typeof TextDecoder;
}

if (typeof runtime.TextEncoder === 'undefined') {
  runtime.TextEncoder = PolyfillTextEncoder as unknown as typeof TextEncoder;
}

// Some web3/browser-first libraries assume `window` event APIs exist.
// Hermes in React Native does not provide these by default.
const noop = () => {};
const falseReturn = () => false;

if (typeof runtime.window === 'undefined') {
  runtime.window = {};
}

if (typeof runtime.crypto === 'undefined') {
  runtime.crypto = {};
}

if (typeof runtime.crypto.getRandomValues !== 'function') {
  runtime.crypto.getRandomValues = <T extends ArrayBufferView>(array: T): T => {
    return ExpoCrypto.getRandomValues(array as never) as T;
  };
}

if (typeof runtime.crypto.randomUUID !== 'function' && typeof ExpoCrypto.randomUUID === 'function') {
  runtime.crypto.randomUUID = () => ExpoCrypto.randomUUID();
}

if (runtime.window && typeof runtime.window.crypto === 'undefined') {
  runtime.window.crypto = runtime.crypto;
}

if (typeof runtime.window.addEventListener !== 'function') {
  runtime.window.addEventListener = noop;
}

if (typeof runtime.window.removeEventListener !== 'function') {
  runtime.window.removeEventListener = noop;
}

if (typeof runtime.window.dispatchEvent !== 'function') {
  runtime.window.dispatchEvent = falseReturn;
}

if (typeof runtime.addEventListener !== 'function') {
  runtime.addEventListener = runtime.window.addEventListener;
}

if (typeof runtime.removeEventListener !== 'function') {
  runtime.removeEventListener = runtime.window.removeEventListener;
}

if (typeof runtime.dispatchEvent !== 'function') {
  runtime.dispatchEvent = runtime.window.dispatchEvent;
}

if (typeof runtime.Event === 'undefined') {
  class EventPolyfill {
    type: string;
    bubbles: boolean;
    cancelable: boolean;
    defaultPrevented = false;

    constructor(type: string, eventInitDict?: { bubbles?: boolean; cancelable?: boolean }) {
      this.type = type;
      this.bubbles = Boolean(eventInitDict?.bubbles);
      this.cancelable = Boolean(eventInitDict?.cancelable);
    }

    preventDefault() {
      if (this.cancelable) {
        this.defaultPrevented = true;
      }
    }
  }

  runtime.Event = EventPolyfill as unknown as EventCtor;
}

if (typeof runtime.CustomEvent === 'undefined') {
  class CustomEventPolyfill<T = unknown> extends (runtime.Event as EventCtor) {
    detail: T;

    constructor(type: string, eventInitDict?: { detail?: T; bubbles?: boolean; cancelable?: boolean }) {
      super(type, eventInitDict);
      this.detail = (eventInitDict?.detail as T);
    }
  }

  runtime.CustomEvent = CustomEventPolyfill as unknown as CustomEventCtor;
}

if (runtime.window && typeof runtime.window.Event === 'undefined') {
  runtime.window.Event = runtime.Event;
}

if (runtime.window && typeof runtime.window.CustomEvent === 'undefined') {
  runtime.window.CustomEvent = runtime.CustomEvent;
}
