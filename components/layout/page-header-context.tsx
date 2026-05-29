'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from 'react';

type PageHeaderActionsContextValue = {
  registerRefresh: (handler: (() => void) | null) => void;
  subscribeRefreshAvailable: (listener: () => void) => () => void;
  getRefreshAvailable: () => boolean;
  invokeRefresh: () => void;
};

const PageHeaderActionsContext = createContext<PageHeaderActionsContextValue | null>(null);

const noopSubscribe = () => () => {};
const alwaysFalse = () => false;

export function PageHeaderActionsProvider({ children }: { children: ReactNode }) {
  const refreshHandlerRef = useRef<(() => void) | null>(null);
  const listenersRef = useRef(new Set<() => void>());

  const notify = useCallback(() => {
    listenersRef.current.forEach((listener) => listener());
  }, []);

  const registerRefresh = useCallback(
    (handler: (() => void) | null) => {
      const wasAvailable = refreshHandlerRef.current != null;
      refreshHandlerRef.current = handler;
      const isAvailable = handler != null;
      if (wasAvailable !== isAvailable) notify();
    },
    [notify]
  );

  const subscribeRefreshAvailable = useCallback((listener: () => void) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const getRefreshAvailable = useCallback(() => refreshHandlerRef.current != null, []);

  const invokeRefresh = useCallback(() => {
    refreshHandlerRef.current?.();
  }, []);

  const value = useMemo(
    () => ({
      registerRefresh,
      subscribeRefreshAvailable,
      getRefreshAvailable,
      invokeRefresh,
    }),
    [registerRefresh, subscribeRefreshAvailable, getRefreshAvailable, invokeRefresh]
  );

  return (
    <PageHeaderActionsContext.Provider value={value}>{children}</PageHeaderActionsContext.Provider>
  );
}

/** Register a page-level Refresh handler for the sticky dashboard header. */
export function usePageHeaderRefresh(onRefresh: (() => void) | undefined) {
  const ctx = useContext(PageHeaderActionsContext);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  const registerRef = useRef(ctx?.registerRefresh);
  registerRef.current = ctx?.registerRefresh;

  const refreshEnabled = onRefresh != null;

  useEffect(() => {
    const register = registerRef.current;
    if (!register) return;

    if (!refreshEnabled) {
      register(null);
      return () => register(null);
    }

    const stableHandler = () => {
      onRefreshRef.current?.();
    };
    register(stableHandler);
    return () => register(null);
  }, [refreshEnabled]);
}

export function usePageHeaderRefreshAction(): (() => void) | null {
  const ctx = useContext(PageHeaderActionsContext);
  const available = useSyncExternalStore(
    ctx?.subscribeRefreshAvailable ?? noopSubscribe,
    ctx?.getRefreshAvailable ?? alwaysFalse,
    alwaysFalse
  );

  if (!available || !ctx) return null;
  return ctx.invokeRefresh;
}
