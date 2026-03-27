export type ToastType =
  | "default"
  | "success"
  | "error"
  | "warning"
  | "info"
  | "loading";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  id?: string | number;
  description?: string;
  duration?: number;
  action?: ToastAction;
  onDismiss?: (toast: ToastItem) => void;
  onAutoClose?: (toast: ToastItem) => void;
}

export interface ToastItem extends ToastOptions {
  id: string | number;
  message: string;
  type: ToastType;
  createdAt: number;
}

type Listener = (toasts: ToastItem[]) => void;

export const DEFAULT_DURATION = 10000;

type ToastStore = {
  counter: number;
  toasts: ToastItem[];
  listeners: Set<Listener>;
  timers: Map<string | number, ReturnType<typeof setTimeout>>;
};

function createStore(): ToastStore {
  return {
    counter: 0,
    toasts: [],
    listeners: new Set<Listener>(),
    timers: new Map<string | number, ReturnType<typeof setTimeout>>(),
  };
}

let _localStore = createStore();

function getStore(): ToastStore {
  if (typeof window === "undefined") return _localStore;
  const w = window as unknown as { __plain_toast_store__?: ToastStore };
  if (!w.__plain_toast_store__) w.__plain_toast_store__ = createStore();
  return w.__plain_toast_store__;
}

function genId(): number {
  const store = getStore();
  store.counter += 1;
  return store.counter;
}

function notify() {
  const store = getStore();
  const snapshot = [...store.toasts];
  store.listeners.forEach((listener) => listener(snapshot));
}

function clearTimer(id: string | number) {
  const store = getStore();
  const timer = store.timers.get(id);
  if (!timer) return;
  clearTimeout(timer);
  store.timers.delete(id);
}

function scheduleTimer(toast: ToastItem) {
  const store = getStore();
  clearTimer(toast.id);
  if (toast.duration === Infinity) return;

  const ms = toast.duration ?? DEFAULT_DURATION;
  const handle = setTimeout(() => {
    const current = getStore();
    const existing = current.toasts.find((t) => t.id === toast.id);
    if (existing) existing.onAutoClose?.(existing);
    dismiss(toast.id);
  }, ms);
  store.timers.set(toast.id, handle);
}

function create(message: string, type: ToastType, opts: ToastOptions = {}) {
  const store = getStore();
  const id = opts.id ?? genId();
  const duration = opts.duration ?? (type === "loading" ? Infinity : DEFAULT_DURATION);

  const item: ToastItem = {
    ...opts,
    id,
    message,
    type,
    duration,
    createdAt: Date.now(),
  };

  const existing = store.toasts.findIndex((t) => t.id === id);
  if (existing === -1) store.toasts = [item, ...store.toasts];
  else store.toasts[existing] = item;

  notify();
  scheduleTimer(item);
  return id;
}

export function dismiss(id?: string | number) {
  const store = getStore();
  if (id === undefined) {
    store.toasts.forEach((t) => {
      clearTimer(t.id);
      t.onDismiss?.(t);
    });
    store.toasts = [];
    notify();
    return;
  }

  const existing = store.toasts.find((t) => t.id === id);
  if (existing) existing.onDismiss?.(existing);
  clearTimer(id);
  store.toasts = store.toasts.filter((t) => t.id !== id);
  notify();
}

interface PromiseOptions<T> {
  loading: string;
  success: string | ((data: T) => string);
  error: string | ((err: unknown) => string);
  description?: string;
  duration?: number;
}

function promise<T>(
  promiseFn: Promise<T> | (() => Promise<T>),
  opts: PromiseOptions<T>
): Promise<T> {
  const id = create(opts.loading, "loading", { duration: Infinity });
  const p = typeof promiseFn === "function" ? promiseFn() : promiseFn;

  p.then((data) => {
    const message =
      typeof opts.success === "function" ? opts.success(data) : opts.success;
    create(message, "success", {
      id,
      description: opts.description,
      duration: opts.duration ?? DEFAULT_DURATION,
    });
  }).catch((error) => {
    const message = typeof opts.error === "function" ? opts.error(error) : opts.error;
    create(message, "error", {
      id,
      duration: opts.duration ?? DEFAULT_DURATION,
    });
  });

  return p;
}

export const toast = Object.assign(
  (message: string, opts?: ToastOptions) => create(message, "default", opts),
  {
    success: (message: string, opts?: ToastOptions) => create(message, "success", opts),
    error: (message: string, opts?: ToastOptions) => create(message, "error", opts),
    warning: (message: string, opts?: ToastOptions) => create(message, "warning", opts),
    info: (message: string, opts?: ToastOptions) => create(message, "info", opts),
    loading: (message: string, opts?: ToastOptions) => create(message, "loading", opts),
    dismiss,
    promise,
  }
);

export function subscribe(listener: Listener): () => void {
  const store = getStore();
  store.listeners.add(listener);
  listener([...store.toasts]);
  return () => store.listeners.delete(listener);
}
