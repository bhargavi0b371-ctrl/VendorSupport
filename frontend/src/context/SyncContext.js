import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api/client';
import { LocalDB } from '../db/localDb';

const SyncContext = createContext();

export const SyncProvider = ({ children }) => {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);

  const refreshPendingCount = async () => {
    try {
      const count = await LocalDB.getPendingCount();
      setPendingCount(count);
    } catch (e) {
      // ignore
    }
  };

  const syncNow = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const res = await api.syncOfflineData();
      try {
        const vProds = await api.getVendorProducts();
        if (vProds) {
          await LocalDB.saveVendorProducts(vProds);
        }
      } catch (err) {
        // ignore product sync error if offline
      }
      await refreshPendingCount();
      setIsOnline(true);
      setLastSyncTime(new Date().toLocaleTimeString());
      return res;
    } catch (e) {
      setIsOnline(false);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    LocalDB.init();
    refreshPendingCount();

    // Check backend health and sync every 15 seconds
    const interval = setInterval(async () => {
      try {
        const count = await LocalDB.getPendingCount();
        setPendingCount(count);
        if (count > 0) {
          await syncNow();
        }
      } catch (e) {
        // ignore
      }
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  return (
    <SyncContext.Provider value={{
      isOnline,
      pendingCount,
      isSyncing,
      lastSyncTime,
      syncNow,
      refreshPendingCount
    }}>
      {children}
    </SyncContext.Provider>
  );
};

export const useSync = () => useContext(SyncContext);
