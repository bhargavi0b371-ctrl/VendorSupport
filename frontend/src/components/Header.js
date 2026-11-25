import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { THEME } from '../constants/theme';
import { useLanguage } from '../context/LanguageContext';
import { useSync } from '../context/SyncContext';
import { LocalDB } from '../db/localDb';

export const Header = ({ title, showBack = false, onBack }) => {
  const { language, toggleLanguage } = useLanguage();
  const { isOnline, pendingCount, syncNow, isSyncing } = useSync();
  const [shopName, setShopName] = useState('');

  useEffect(() => {
    LocalDB.getAuthUser().then(u => {
      if (u && u.shop_name) setShopName(u.shop_name);
    }).catch(() => {});
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.leftRow}>
        {showBack && (
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <MaterialCommunityIcons name="arrow-left" size={28} color="#FFFFFF" />
          </TouchableOpacity>
        )}
        <View style={{ flexShrink: 1 }}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          <Text style={styles.subTitle} numberOfLines={1}>
            {shopName ? `🏪 ${shopName}` : (language === 'ta' ? 'வெண்டார் வாய்ஸ்' : 'VendorVoice')}
          </Text>
        </View>
      </View>

      <View style={styles.rightRow}>
        {/* Sync Status Badge */}
        <TouchableOpacity 
          onPress={syncNow}
          style={[styles.syncBadge, isOnline ? styles.onlineBadge : styles.offlineBadge]}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons 
            name={isSyncing ? "sync" : (isOnline ? "wifi-check" : "wifi-off")} 
            size={16} 
            color={isOnline ? "#1B5E20" : "#B71C1C"} 
          />
          <Text style={[styles.syncText, isOnline ? styles.onlineText : styles.offlineText]}>
            {pendingCount > 0 ? `${pendingCount} ⏳` : (isOnline ? "Online" : "Offline")}
          </Text>
        </TouchableOpacity>

        {/* Language Toggle Button */}
        <TouchableOpacity 
          onPress={toggleLanguage}
          style={styles.langButton}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="translate" size={18} color="#111827" />
          <Text style={styles.langText}>
            {language === 'ta' ? 'EN' : 'தமிழ்'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: THEME.colors.primary,
    paddingTop: 16,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3
  },
  leftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  backButton: {
    marginRight: 12,
    padding: 6
  },
  title: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.3
  },
  subTitle: {
    color: '#A5D6A7',
    fontSize: 12,
    fontWeight: '600'
  },
  rightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  syncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4
  },
  onlineBadge: {
    backgroundColor: '#C8E6C9'
  },
  offlineBadge: {
    backgroundColor: '#FFCDD2'
  },
  syncText: {
    fontSize: 12,
    fontWeight: '700'
  },
  onlineText: {
    color: '#1B5E20'
  },
  offlineText: {
    color: '#B71C1C'
  },
  langButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5
  },
  langText: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '800'
  }
});
