import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { THEME } from '../constants/theme';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../api/client';
import { LocalDB } from '../db/localDb';

export const AuthScreen = ({ onAuthSuccess }) => {
  const { t, language, setLanguage } = useLanguage();

  // Mode: 'register' | 'login'
  const [isRegister, setIsRegister] = useState(true);

  // Form Fields
  const [shopName, setShopName] = useState('முருகன் காய்கறி அங்காடி');
  const [vendorName, setVendorName] = useState('முருகன் கே');
  const [phone, setPhone] = useState('9876543210');
  const [pin, setPin] = useState('1234');

  const [loading, setLoading] = useState(false);

  const toggleLanguage = () => {
    const nextLang = language === 'ta' ? 'en' : 'ta';
    setLanguage(nextLang);
    if (nextLang === 'en' && shopName === 'முருகன் காய்கறி அங்காடி') {
      setShopName('Murugan Vegetable Stall');
      setVendorName('Murugan K');
    } else if (nextLang === 'ta' && shopName === 'Murugan Vegetable Stall') {
      setShopName('முருகன் காய்கறி அங்காடி');
      setVendorName('முருகன் கே');
    }
  };

  const handleQuickDemo = async () => {
    const demoShop = language === 'ta' ? 'முருகன் காய்கறி அங்காடி' : 'Murugan Vegetable Stall';
    const demoName = language === 'ta' ? 'முருகன் கே' : 'Murugan K';
    const demoPhone = '9876543210';
    const demoPin = '1234';

    setShopName(demoShop);
    setVendorName(demoName);
    setPhone(demoPhone);
    setPin(demoPin);

    setLoading(true);
    try {
      const res = await api.registerVendor({
        name: demoName,
        shop_name: demoShop,
        phone: demoPhone,
        pin: demoPin,
        language
      });
      if (onAuthSuccess) {
        onAuthSuccess(res.user);
      }
    } catch (e) {
      // Offline fallback
      const user = {
        id: 1,
        name: demoName,
        shop_name: demoShop,
        phone: demoPhone,
        language,
        onboarding_completed: false
      };
      await LocalDB.setAuthUser(user);
      if (onAuthSuccess) onAuthSuccess(user);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!phone.trim()) {
      Alert.alert(
        language === 'ta' ? 'பிழை' : 'Error',
        language === 'ta' ? 'தயவுசெய்து மொபைல் எண்ணை உள்ளிடவும்' : 'Please enter your phone number'
      );
      return;
    }

    if (!pin.trim()) {
      Alert.alert(
        language === 'ta' ? 'பிழை' : 'Error',
        language === 'ta' ? 'தயவுசெய்து 4 இலக்க பின் எண்ணை உள்ளிடவும்' : 'Please enter a 4-digit security PIN'
      );
      return;
    }

    if (isRegister) {
      if (!shopName.trim()) {
        Alert.alert(
          language === 'ta' ? 'பிழை' : 'Error',
          language === 'ta' ? 'தயவுசெய்து உங்கள் கடையின் பெயரை உள்ளிடவும்' : 'Please enter your shop\'s name'
        );
        return;
      }
      if (!vendorName.trim()) {
        Alert.alert(
          language === 'ta' ? 'பிழை' : 'Error',
          language === 'ta' ? 'தயவுசெய்து உங்கள் பெயரை உள்ளிடவும்' : 'Please enter the vendor\'s name'
        );
        return;
      }
    }

    setLoading(true);
    try {
      let res;
      if (isRegister) {
        res = await api.registerVendor({
          name: vendorName.trim(),
          shop_name: shopName.trim(),
          phone: phone.trim(),
          pin: pin.trim(),
          language
        });
      } else {
        res = await api.loginVendor({
          phone: phone.trim(),
          pin: pin.trim()
        });
      }

      if (res && res.user && onAuthSuccess) {
        onAuthSuccess(res.user);
      }
    } catch (e) {
      Alert.alert(
        language === 'ta' ? 'உள்நுழைவு தோல்வி' : 'Authentication Failed',
        language === 'ta'
          ? 'தொலைபேசி எண் அல்லது பின் தவறானது. புதிய கடையா என சரிபார்க்கவும்.'
          : 'Incorrect phone number or PIN. Check details or register as new shop.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* TOP BAR / LANGUAGE TOGGLE */}
        <View style={styles.topRow}>
          <View style={styles.badgeRow}>
            <MaterialCommunityIcons name="shield-check" size={20} color="#15803D" />
            <Text style={styles.badgeText}>Vendor Security</Text>
          </View>
          <TouchableOpacity onPress={toggleLanguage} style={styles.langBtn} activeOpacity={0.7}>
            <MaterialCommunityIcons name="translate" size={18} color="#FFFFFF" />
            <Text style={styles.langBtnText}>{language === 'ta' ? 'English' : 'தமிழ்'}</Text>
          </TouchableOpacity>
        </View>

        {/* HERO BRAND HEADER */}
        <View style={styles.heroBox}>
          <View style={styles.storeIconCircle}>
            <MaterialCommunityIcons name="storefront" size={46} color="#FFFFFF" />
          </View>
          <Text style={styles.appTitle}>VendorVoice</Text>
          <Text style={styles.authTitle}>{t('authTitle')}</Text>
          <Text style={styles.authSub}>{t('authSubtitle')}</Text>
        </View>

        {/* FORM CARD */}
        <View style={styles.formCard}>
          {/* TAB TOGGLE: LOGIN / REGISTER */}
          <View style={styles.tabToggle}>
            <TouchableOpacity
              onPress={() => setIsRegister(true)}
              style={[styles.tabBtn, isRegister && styles.tabBtnActive]}
            >
              <Text style={[styles.tabText, isRegister && styles.tabTextActive]}>
                {language === 'ta' ? 'புதிய கடை பதிவு' : 'New Shop Signup'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setIsRegister(false)}
              style={[styles.tabBtn, !isRegister && styles.tabBtnActive]}
            >
              <Text style={[styles.tabText, !isRegister && styles.tabTextActive]}>
                {language === 'ta' ? 'உள்நுழைக (Login)' : 'Vendor Login'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* SHOP NAME (Shown in Register Mode) */}
          {isRegister && (
            <View style={styles.fieldGroup}>
              <View style={styles.labelRow}>
                <MaterialCommunityIcons name="store" size={18} color={THEME.colors.primary} />
                <Text style={styles.inputLabel}>{t('shopNameLabel')} *</Text>
              </View>
              <TextInput
                style={styles.textInput}
                placeholder={t('shopNamePlaceholder')}
                placeholderTextColor="#9CA3AF"
                value={shopName}
                onChangeText={setShopName}
              />
            </View>
          )}

          {/* VENDOR'S NAME (Shown in Register Mode) */}
          {isRegister && (
            <View style={styles.fieldGroup}>
              <View style={styles.labelRow}>
                <MaterialCommunityIcons name="account" size={18} color={THEME.colors.primary} />
                <Text style={styles.inputLabel}>{t('vendorNameLabel')} *</Text>
              </View>
              <TextInput
                style={styles.textInput}
                placeholder={t('vendorNamePlaceholder')}
                placeholderTextColor="#9CA3AF"
                value={vendorName}
                onChangeText={setVendorName}
              />
            </View>
          )}

          {/* PHONE NUMBER */}
          <View style={styles.fieldGroup}>
            <View style={styles.labelRow}>
              <MaterialCommunityIcons name="phone" size={18} color={THEME.colors.primary} />
              <Text style={styles.inputLabel}>{t('phoneLabel')} *</Text>
            </View>
            <TextInput
              style={styles.textInput}
              placeholder={t('phonePlaceholder')}
              placeholderTextColor="#9CA3AF"
              keyboardType="phone-pad"
              maxLength={15}
              value={phone}
              onChangeText={setPhone}
            />
          </View>

          {/* SECURITY PIN */}
          <View style={styles.fieldGroup}>
            <View style={styles.labelRow}>
              <MaterialCommunityIcons name="lock" size={18} color={THEME.colors.primary} />
              <Text style={styles.inputLabel}>{t('pinLabel')} *</Text>
            </View>
            <TextInput
              style={styles.textInput}
              placeholder={t('pinPlaceholder')}
              placeholderTextColor="#9CA3AF"
              keyboardType="numeric"
              secureTextEntry={true}
              maxLength={6}
              value={pin}
              onChangeText={setPin}
            />
          </View>

          {/* SUBMIT BUTTON */}
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={loading}
            style={styles.submitBtn}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <MaterialCommunityIcons
                  name={isRegister ? "account-plus" : "login"}
                  size={24}
                  color="#FFFFFF"
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.submitBtnText}>
                  {isRegister ? t('registerBtn') : t('loginBtn')}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* QUICK DEMO LOGIN BUTTON FOR EASY 1-CLICK TESTING */}
          <TouchableOpacity
            onPress={handleQuickDemo}
            disabled={loading}
            style={styles.demoBtn}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="lightning-bolt" size={20} color="#D97706" />
            <Text style={styles.demoBtnText}>
              {language === 'ta'
                ? 'விரைவு சோதனை: முருகன் அங்காடியாக உள்நுழைக'
                : '1-Click Quick Demo Login (Murugan)'}
            </Text>
          </TouchableOpacity>

          {/* MODE SWITCH LINK */}
          <TouchableOpacity
            onPress={() => setIsRegister(!isRegister)}
            style={styles.switchLink}
            activeOpacity={0.7}
          >
            <Text style={styles.switchLinkText}>
              {isRegister ? t('switchToLogin') : t('switchToRegister')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* SECURITY FOOTER NOTE */}
        <View style={styles.footerNote}>
          <MaterialCommunityIcons name="lock-check" size={16} color="#6B7280" />
          <Text style={styles.footerNoteText}>
            {language === 'ta'
              ? 'உங்கள் கடைக் கணக்கு முழு பாதுகாப்புடன் பராமரிக்கப்படுகிறது'
              : 'Your shop records are stored securely with authenticated access'}
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6'
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 6
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#15803D'
  },
  langBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6
  },
  langBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800'
  },
  heroBox: {
    alignItems: 'center',
    marginBottom: 18,
    marginTop: 6
  },
  storeIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: THEME.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: THEME.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    marginBottom: 12
  },
  appTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: THEME.colors.primary,
    letterSpacing: 0.5
  },
  authTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111827',
    marginTop: 4,
    textAlign: 'center'
  },
  authSub: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 20,
    lineHeight: 18
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6
  },
  tabToggle: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
    padding: 4,
    marginBottom: 18
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10
  },
  tabBtnActive: {
    backgroundColor: '#FFFFFF',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280'
  },
  tabTextActive: {
    color: THEME.colors.primary,
    fontWeight: '900'
  },
  fieldGroup: {
    marginBottom: 14
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#374151'
  },
  textInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: '600',
    color: '#111827'
  },
  submitBtn: {
    backgroundColor: THEME.colors.primary,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginTop: 10,
    elevation: 4,
    shadowColor: THEME.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5
  },
  demoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF3C7',
    borderWidth: 1.5,
    borderColor: '#FCD34D',
    borderRadius: 14,
    paddingVertical: 12,
    marginTop: 14,
    gap: 6
  },
  demoBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#92400E'
  },
  switchLink: {
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 6
  },
  switchLinkText: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.colors.primary,
    textDecorationLine: 'underline'
  },
  footerNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    gap: 6
  },
  footerNoteText: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center'
  }
});
