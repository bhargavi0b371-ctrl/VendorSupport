import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { THEME } from '../constants/theme';
import { useLanguage } from '../context/LanguageContext';
import { useSync } from '../context/SyncContext';
import { useVoice } from '../hooks/useVoice';
import { api } from '../api/client';
import { Header } from '../components/Header';
import { BigButton } from '../components/BigButton';

export const SettingsScreen = ({ onNavigate }) => {
  const { t, language, setLanguage } = useLanguage();
  const { isOnline, pendingCount, syncNow, isSyncing, lastSyncTime } = useSync();
  const { speak } = useVoice();
  const [marginPct, setMarginPct] = useState(25.0);
  const [items, setItems] = useState([]);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const u = await api.getUserSettings();
        if (u && u.default_margin_pct) setMarginPct(u.default_margin_pct);
        const itms = await api.getItems();
        setItems(itms);
      } catch (e) {
        console.warn("Failed to load settings", e);
      }
    };
    loadSettings();
  }, []);

  const handleLanguageChange = async (newLang) => {
    await setLanguage(newLang);
    await api.updateUserSettings({ language: newLang });
    const msg = newLang === 'ta' ? 'தமிழ் மொழி தேர்வு செய்யப்பட்டது' : 'English language selected';
    speak(msg, newLang);
  };

  const handleMarginChange = async (newMargin) => {
    setMarginPct(newMargin);
    await api.updateUserSettings({ default_margin_pct: newMargin });
    const msg = language === 'ta' ? `லாப சதவீதம் ${newMargin}% என மாற்றப்பட்டது` : `Profit margin set to ${newMargin}%`;
    speak(msg);
  };

  const toggleItemActive = (itemId) => {
    setItems(items.map(it => it.id === itemId ? { ...it, is_active: !it.is_active } : it));
  };

  const handleManualSync = async () => {
    try {
      const res = await syncNow();
      const msg = language === 'ta' ? 'அனைத்து தரவுகளும் வெற்றிகரமாக ஒத்திசைக்கப்பட்டது' : 'Successfully synced with server';
      speak(msg);
    } catch (e) {
      const msg = language === 'ta' ? 'இன்டர்நெட் தொடர்பு இல்லை. ஆஃப்லைனில் சேமிக்கப்பட்டது.' : 'No internet. Saved offline safely.';
      speak(msg);
    }
  };

  return (
    <View style={styles.screen}>
      <Header title={t('settingsTitle')} showBack onBack={() => onNavigate('home')} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* 1. LANGUAGE SETTINGS */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <MaterialCommunityIcons name="translate" size={24} color={THEME.colors.primary} />
            <Text style={styles.sectionTitle}>{t('appLanguage')}</Text>
          </View>

          <View style={styles.langChoicesRow}>
            <TouchableOpacity
              onPress={() => handleLanguageChange('ta')}
              style={[
                styles.langOption,
                language === 'ta' && styles.langOptionActive
              ]}
              activeOpacity={0.8}
            >
              <Text style={[styles.langOptionTitle, language === 'ta' && styles.langOptionTitleActive]}>
                தமிழ் (Tamil)
              </Text>
              <Text style={styles.langOptionSub}>குரல் & வாசகம்</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleLanguageChange('en')}
              style={[
                styles.langOption,
                language === 'en' && styles.langOptionActive
              ]}
              activeOpacity={0.8}
            >
              <Text style={[styles.langOptionTitle, language === 'en' && styles.langOptionTitleActive]}>
                English
              </Text>
              <Text style={styles.langOptionSub}>Voice & Text</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 2. PROFIT MARGIN PERCENTAGE SETTING */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <MaterialCommunityIcons name="percent" size={24} color={THEME.colors.primary} />
            <Text style={styles.sectionTitle}>{t('profitMarginSetting')}</Text>
          </View>
          <Text style={styles.sectionDesc}>
            {language === 'ta' ? 
              'மொத்த விலையோடு இந்த லாபம் சேர்க்கப்பட்டு விற்பனை விலை பரிந்துரைக்கப்படும்.' : 
              'Added over wholesale mandi rate to calculate fair selling price.'}
          </Text>

          <View style={styles.marginOptionsRow}>
            {[15, 20, 25, 30].map((pct) => (
              <TouchableOpacity
                key={pct}
                onPress={() => handleMarginChange(pct)}
                style={[
                  styles.marginChip,
                  marginPct === pct && styles.marginChipActive
                ]}
                activeOpacity={0.8}
              >
                <Text style={[styles.marginChipText, marginPct === pct && styles.marginChipTextActive]}>
                  {pct}%
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 3. OFFLINE SYNC STATUS */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <MaterialCommunityIcons 
              name={isOnline ? "cloud-check" : "cloud-off-outline"} 
              size={24} 
              color={isOnline ? "#1B5E20" : "#C62828"} 
            />
            <Text style={styles.sectionTitle}>{t('offlineSyncStatus')}</Text>
          </View>

          <View style={styles.syncStatusBox}>
            <View style={styles.syncRow}>
              <Text style={styles.syncLabel}>Status:</Text>
              <Text style={[styles.syncStatusText, { color: isOnline ? '#1B5E20' : '#C62828' }]}>
                {isOnline ? "🟢 Connected to Server" : "🟠 Working Offline (No Internet)"}
              </Text>
            </View>

            <View style={styles.syncRow}>
              <Text style={styles.syncLabel}>Queue:</Text>
              <Text style={styles.syncQueueText}>
                {pendingCount > 0 ? `${pendingCount} ${t('pendingOfflineItems')}` : `✅ ${t('synced')}`}
              </Text>
            </View>

            {lastSyncTime && (
              <View style={styles.syncRow}>
                <Text style={styles.syncLabel}>Last Sync:</Text>
                <Text style={styles.syncQueueText}>{lastSyncTime}</Text>
              </View>
            )}
          </View>

          <BigButton
            title={t('syncNow')}
            icon="sync"
            color={THEME.colors.primary}
            onPress={handleManualSync}
            size="medium"
            disabled={isSyncing}
          />

          <Text style={styles.offlineNoticeText}>{t('offlineModeNotice')}</Text>
        </View>

        {/* 4. ITEM CATALOG & MANAGE PRODUCTS */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <MaterialCommunityIcons name="format-list-checks" size={24} color={THEME.colors.primary} />
            <Text style={styles.sectionTitle}>{t('itemCatalog')} ({items.length})</Text>
          </View>

          <TouchableOpacity
            onPress={() => onNavigate && onNavigate('onboarding_edit')}
            style={styles.manageProductsBtn}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="playlist-edit" size={22} color="#FFFFFF" />
            <Text style={styles.manageProductsBtnText}>{t('editMyProducts')}</Text>
          </TouchableOpacity>

          {items.map((it) => (
            <View key={it.id} style={styles.itemRow}>
              <View style={styles.itemLeft}>
                <View style={[styles.itemDot, { backgroundColor: it.color || '#4CAF50' }]} />
                <View>
                  <Text style={styles.itemNameText}>
                    {language === 'ta' ? it.name_ta : it.name_en}
                  </Text>
                  <Text style={styles.itemSubText}>
                    {language === 'ta' ? it.name_en : it.name_ta} • {it.default_unit}
                  </Text>
                </View>
              </View>

              <Switch
                value={it.is_active !== false}
                onValueChange={() => toggleItemActive(it.id)}
                trackColor={{ false: "#D1D5DB", true: "#A5D6A7" }}
                thumbColor={it.is_active !== false ? THEME.colors.primary : "#9CA3AF"}
              />
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: THEME.colors.bg
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB'
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827'
  },
  sectionDesc: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 12
  },
  langChoicesRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6
  },
  langOption: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    padding: 14,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    alignItems: 'center'
  },
  langOptionActive: {
    borderColor: THEME.colors.primary,
    backgroundColor: '#F1F8E9'
  },
  langOptionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#374151'
  },
  langOptionTitleActive: {
    color: THEME.colors.primary
  },
  langOptionSub: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2
  },
  marginOptionsRow: {
    flexDirection: 'row',
    gap: 10
  },
  marginChip: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB'
  },
  marginChipActive: {
    backgroundColor: THEME.colors.primary,
    borderColor: THEME.colors.primary
  },
  marginChipText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#374151'
  },
  marginChipTextActive: {
    color: '#FFFFFF'
  },
  syncStatusBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    marginVertical: 10,
    gap: 6
  },
  syncRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  syncLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280'
  },
  syncStatusText: {
    fontSize: 13,
    fontWeight: '800'
  },
  syncQueueText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#111827'
  },
  offlineNoticeText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 8,
    lineHeight: 16
  },
  manageProductsBtn: {
    backgroundColor: THEME.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: THEME.borderRadius.md,
    gap: 8,
    marginBottom: 14
  },
  manageProductsBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800'
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6'
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  itemDot: {
    width: 12,
    height: 12,
    borderRadius: 6
  },
  itemNameText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827'
  },
  itemSubText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 1
  }
});
