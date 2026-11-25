import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert, TextInput, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { THEME } from '../constants/theme';
import { useLanguage } from '../context/LanguageContext';
import { useSync } from '../context/SyncContext';
import { useVoice } from '../hooks/useVoice';
import { api } from '../api/client';
import { LocalDB } from '../db/localDb';
import { Header } from '../components/Header';
import { BigButton } from '../components/BigButton';

export const SettingsScreen = ({ onNavigate, onLogout }) => {
  const { t, language, setLanguage } = useLanguage();
  const { isOnline, pendingCount, syncNow, isSyncing, lastSyncTime } = useSync();
  const { speak } = useVoice();
  const [marginPct, setMarginPct] = useState(25.0);
  const [items, setItems] = useState([]);
  const [profile, setProfile] = useState(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editShopName, setEditShopName] = useState('');
  const [editVendorName, setEditVendorName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editPin, setEditPin] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const u = await LocalDB.getAuthUser();
      if (u) {
        setProfile(u);
        setEditShopName(u.shop_name || '');
        setEditVendorName(u.name || '');
        setEditPhone(u.phone || '');
        setEditPin(u.pin || '1234');
      }

      const settings = await api.getUserSettings();
      if (settings && settings.default_margin_pct) setMarginPct(settings.default_margin_pct);
      const itms = await api.getVendorProducts();
      setItems(itms);
    } catch (e) {
      console.warn("Failed to load settings", e);
    }
  };

  const handleSaveProfile = async () => {
    if (!editShopName.trim() || !editVendorName.trim()) {
      Alert.alert(language === 'ta' ? 'பிழை' : 'Error', language === 'ta' ? 'கடை மற்றும் வியாபாரி பெயரை உள்ளிடவும்' : 'Shop and vendor names required');
      return;
    }
    setSavingProfile(true);
    try {
      const updated = await api.updateVendorProfile({
        name: editVendorName.trim(),
        shop_name: editShopName.trim(),
        phone: editPhone.trim(),
        pin: editPin.trim()
      });
      setProfile(updated);
      setIsEditingProfile(false);
      Alert.alert(language === 'ta' ? 'வெற்றி' : 'Saved', language === 'ta' ? 'சுயவிவரம் சேமிக்கப்பட்டது' : 'Profile updated successfully');
    } catch (e) {
      console.warn("Save profile error", e);
    } finally {
      setSavingProfile(false);
    }
  };

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

  const toggleItemActive = async (itemId) => {
    const it = items.find(x => x.id === itemId);
    if (!it) return;
    const nextState = it.is_active === false ? true : false;
    setItems(items.map(x => x.id === itemId ? { ...x, is_active: nextState } : x));
    try {
      await api.toggleVendorProduct(itemId, nextState);
    } catch (e) {
      console.warn("Toggle vendor product error", e);
    }
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
        {/* VENDOR PROFILE CARD */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <MaterialCommunityIcons name="store" size={24} color={THEME.colors.primary} />
            <Text style={styles.sectionTitle}>{t('profileTitle')}</Text>
          </View>

          {profile && !isEditingProfile && (
            <View style={styles.profileDisplayBox}>
              <View style={styles.profileRow}>
                <MaterialCommunityIcons name="storefront" size={20} color={THEME.colors.primary} />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.profileLabel}>{t('shopNameLabel')}</Text>
                  <Text style={styles.profileValue}>{profile.shop_name || 'My Shop'}</Text>
                </View>
              </View>

              <View style={styles.profileRow}>
                <MaterialCommunityIcons name="account" size={20} color={THEME.colors.primary} />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.profileLabel}>{t('vendorNameLabel')}</Text>
                  <Text style={styles.profileValue}>{profile.name || 'Vendor'}</Text>
                </View>
              </View>

              <View style={styles.profileRow}>
                <MaterialCommunityIcons name="phone" size={20} color={THEME.colors.primary} />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.profileLabel}>{t('phoneLabel')}</Text>
                  <Text style={styles.profileValue}>{profile.phone || '-'}</Text>
                </View>
              </View>

              <View style={styles.profileBtnRow}>
                <TouchableOpacity
                  onPress={() => setIsEditingProfile(true)}
                  style={styles.editProfileBtn}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons name="pencil" size={18} color="#FFFFFF" />
                  <Text style={styles.editProfileBtnText}>{t('editProfile')}</Text>
                </TouchableOpacity>

                {onLogout && (
                  <TouchableOpacity
                    onPress={onLogout}
                    style={styles.logoutBtn}
                    activeOpacity={0.8}
                  >
                    <MaterialCommunityIcons name="logout" size={18} color="#DC2626" />
                    <Text style={styles.logoutBtnText}>{t('logoutBtn')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {isEditingProfile && (
            <View style={styles.editProfileForm}>
              <Text style={styles.fieldLabel}>{t('shopNameLabel')} *</Text>
              <TextInput
                style={styles.textInput}
                value={editShopName}
                onChangeText={setEditShopName}
                placeholder={t('shopNamePlaceholder')}
              />

              <Text style={styles.fieldLabel}>{t('vendorNameLabel')} *</Text>
              <TextInput
                style={styles.textInput}
                value={editVendorName}
                onChangeText={setEditVendorName}
                placeholder={t('vendorNamePlaceholder')}
              />

              <Text style={styles.fieldLabel}>{t('phoneLabel')} *</Text>
              <TextInput
                style={styles.textInput}
                value={editPhone}
                onChangeText={setEditPhone}
                keyboardType="phone-pad"
                placeholder={t('phonePlaceholder')}
              />

              <Text style={styles.fieldLabel}>{t('pinLabel')} *</Text>
              <TextInput
                style={styles.textInput}
                value={editPin}
                onChangeText={setEditPin}
                keyboardType="numeric"
                secureTextEntry={true}
                placeholder="4-digit PIN"
              />

              <View style={styles.formBtnRow}>
                <TouchableOpacity
                  onPress={() => setIsEditingProfile(false)}
                  style={styles.cancelBtn}
                >
                  <Text style={styles.cancelBtnText}>{t('cancel')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleSaveProfile}
                  disabled={savingProfile}
                  style={styles.saveProfileBtn}
                >
                  {savingProfile ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.saveProfileBtnText}>{t('save')}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

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

          {items.length === 0 && (
            <View style={{ paddingVertical: 16, alignItems: 'center' }}>
              <Text style={{ color: '#6B7280', fontSize: 13, textAlign: 'center' }}>
                {language === 'ta'
                  ? 'பொருட்கள் எதுவும் தேர்வு செய்யப்படவில்லை. மேலே உள்ள பொத்தானை அழுத்தி சேர்க்கவும்.'
                  : 'No products chosen yet. Tap the button above to select products.'}
              </Text>
            </View>
          )}

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
  },
  profileDisplayBox: {
    marginTop: 6
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6'
  },
  profileLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280'
  },
  profileValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
    marginTop: 2
  },
  profileBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14
  },
  editProfileBtn: {
    flex: 1,
    backgroundColor: THEME.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6
  },
  editProfileBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14
  },
  logoutBtn: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6
  },
  logoutBtnText: {
    color: '#DC2626',
    fontWeight: '800',
    fontSize: 14
  },
  editProfileForm: {
    marginTop: 6
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginTop: 8,
    marginBottom: 4
  },
  textInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
    color: '#111827'
  },
  formBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 14
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F3F4F6'
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6B7280'
  },
  saveProfileBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: THEME.colors.primary
  },
  saveProfileBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF'
  }
});
