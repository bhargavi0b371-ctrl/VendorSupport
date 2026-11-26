import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { THEME } from '../constants/theme';
import { useLanguage } from '../context/LanguageContext';
import { useSync } from '../context/SyncContext';
import { useVoice } from '../hooks/useVoice';
import { api } from '../api/client';
import { LocalDB } from '../db/localDb';
import { Header } from '../components/Header';
import { BigButton } from '../components/BigButton';

export const HomeScreen = ({ onNavigate, onLogout }) => {
  const { t, language } = useLanguage();
  const { isOnline } = useSync();
  const { speak } = useVoice();
  const [profile, setProfile] = useState(null);
  const [summary, setSummary] = useState({
    total_sales: 0,
    total_purchases: 0,
    net_profit: 0,
    sales_count: 0
  });
  const [alerts, setAlerts] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUndoSale, setLastUndoSale] = useState(null);

  const loadData = async () => {
    try {
      const u = await LocalDB.getAuthUser();
      setProfile(u);

      const sum = await api.getTodaySummary();
      setSummary(sum);

      // Load pricing for price alerts
      const pricings = await api.getSmartPricing();
      const alertItems = pricings
        .filter(p => p.price_trend === 'up' || p.festival_tag)
        .slice(0, 3);
      setAlerts(alertItems);
    } catch (e) {
      console.warn("Failed to load home data", e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleSpeakProfit = () => {
    const textEn = `Today's total sales: ₹${summary.total_sales}, purchases: ₹${summary.total_purchases}. Your net profit is ₹${summary.net_profit}.`;
    const textTa = `இன்றைய விற்பனை ₹${summary.total_sales}, வாங்கியது ₹${summary.total_purchases}. உங்கள் நிகர லாபம் ₹${summary.net_profit}.`;
    speak(language === 'ta' ? textTa : textEn);
  };

  const handleUndo = async () => {
    try {
      const res = await api.undoLastSale();
      setLastUndoSale(res);
      await loadData();
      const msg = language === 'ta' ? res.message_ta : res.message_en;
      speak(msg);
    } catch (e) {
      // ignore
    }
  };

  const isProfitPositive = summary.net_profit >= 0;

  return (
    <View style={styles.screen}>
      <Header title={t('appName')} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* VENDOR PROFILE HEADER CARD */}
        {profile && (
          <View style={styles.profileCard}>
            <View style={styles.profileTopRow}>
              <View style={styles.shopAvatarCircle}>
                <MaterialCommunityIcons name="storefront" size={26} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.profileShopName} numberOfLines={1}>
                  {profile.shop_name || 'My Shop'}
                </Text>
                <View style={styles.profileDetailsRow}>
                  <Text style={styles.profileVendorName}>
                    👤 {profile.name || 'Vendor'}
                  </Text>
                  {profile.phone && (
                    <Text style={styles.profilePhone}>
                      • 📞 {profile.phone}
                    </Text>
                  )}
                </View>
              </View>
            </View>

            <View style={styles.profileActionsRow}>
              <TouchableOpacity
                onPress={() => onNavigate('onboarding_edit')}
                style={styles.profileActionPill}
                activeOpacity={0.75}
              >
                <MaterialCommunityIcons name="playlist-edit" size={16} color={THEME.colors.primary} />
                <Text style={styles.profileActionText}>
                  {language === 'ta' ? 'கடை பொருட்கள்' : 'Manage Products'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => onNavigate('settings')}
                style={styles.profileActionPill}
                activeOpacity={0.75}
              >
                <MaterialCommunityIcons name="account-cog-outline" size={16} color="#4B5563" />
                <Text style={[styles.profileActionText, { color: '#4B5563' }]}>
                  {language === 'ta' ? 'சுயவிவரம்' : 'Profile'}
                </Text>
              </TouchableOpacity>

              {onLogout && (
                <TouchableOpacity
                  onPress={onLogout}
                  style={[styles.profileActionPill, { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' }]}
                  activeOpacity={0.75}
                >
                  <MaterialCommunityIcons name="logout" size={15} color="#DC2626" />
                  <Text style={[styles.profileActionText, { color: '#DC2626' }]}>
                    {t('logoutBtn')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
        {/* BIG MIC HERO BUTTON (Centerpiece) */}
        <View style={styles.micSection}>
          <TouchableOpacity
            onPress={() => onNavigate('voice')}
            activeOpacity={0.82}
            style={styles.micCircle}
          >
            <View style={styles.micInner}>
              <MaterialCommunityIcons name="microphone" size={54} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
          <Text style={styles.micLabel}>{t('tapToSpeak')}</Text>
          <Text style={styles.micInstruction}>{t('speakInstruction')}</Text>
        </View>

        {/* DAILY SALES ENTRY HERO ACTION */}
        <TouchableOpacity
          onPress={() => onNavigate('dailySalesEntry')}
          style={styles.dailyEntryBanner}
          activeOpacity={0.85}
        >
          <View style={styles.dailyEntryIconCircle}>
            <MaterialCommunityIcons name="clipboard-text-clock" size={28} color="#FFFFFF" />
          </View>
          <View style={styles.dailyEntryTextCol}>
            <Text style={styles.dailyEntryTitle}>{t('logDailySales')}</Text>
            <Text style={styles.dailyEntrySub}>
              {language === 'ta' ? 'சரக்கு, செலவு, ரொக்கம்/UPI பதிவு செய்து அறிக்கை பெறவும்' : 'Log product sales, costs, expenses & get report'}
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={28} color={THEME.colors.primary} />
        </TouchableOpacity>

        {/* TODAY PROFIT & SALES SUMMARY CARDS */}
        <View style={styles.cardsRow}>
          {/* Today Profit Card */}
          <TouchableOpacity 
            onPress={handleSpeakProfit}
            style={[
              styles.summaryCard, 
              isProfitPositive ? styles.profitCardBg : styles.lossCardBg
            ]}
            activeOpacity={0.85}
          >
            <View style={styles.cardHeaderRow}>
              <MaterialCommunityIcons 
                name={isProfitPositive ? "trending-up" : "trending-down"} 
                size={22} 
                color={isProfitPositive ? THEME.colors.profit : THEME.colors.loss} 
              />
              <Text style={styles.cardTitle}>{t('todayProfit')}</Text>
              <MaterialCommunityIcons name="volume-high" size={16} color="#6B7280" />
            </View>
            <Text 
              style={[
                styles.profitAmount, 
                { color: isProfitPositive ? THEME.colors.profit : THEME.colors.loss }
              ]}
            >
              ₹{summary.net_profit}
            </Text>
            <Text style={styles.cardSub}>
              {isProfitPositive ? t('netProfit') : t('netLoss')}
            </Text>
          </TouchableOpacity>

          {/* Today Sales Card */}
          <TouchableOpacity 
            onPress={() => onNavigate('reports')}
            style={[styles.summaryCard, styles.salesCardBg]}
            activeOpacity={0.85}
          >
            <View style={styles.cardHeaderRow}>
              <MaterialCommunityIcons name="cash-multiple" size={22} color={THEME.colors.salesBlue} />
              <Text style={styles.cardTitle}>{t('todaySales')}</Text>
            </View>
            <Text style={[styles.profitAmount, { color: THEME.colors.salesBlue }]}>
              ₹{summary.total_sales}
            </Text>
            <Text style={styles.cardSub}>
              {summary.sales_count} {language === 'ta' ? 'விற்பனைகள்' : 'sales'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* UNDO BANNER (If recent sale exists) */}
        <TouchableOpacity 
          onPress={handleUndo}
          style={styles.undoBanner}
          activeOpacity={0.85}
        >
          <MaterialCommunityIcons name="undo-variant" size={24} color="#C62828" />
          <View style={styles.undoTextContainer}>
            <Text style={styles.undoTitle}>
              {language === 'ta' ? 'கடைசி விற்பனையை ரத்து செய்ய' : 'Undo Last Sale'}
            </Text>
            <Text style={styles.undoSub}>
              {language === 'ta' ? 'தவறாக பதிவானால் உடனே ரத்து செய்யலாம்' : 'Tap to revert accidental entry'}
            </Text>
          </View>
        </TouchableOpacity>

        {/* MARKET PRICE ALERTS & FESTIVAL UPLIFTS */}
        {alerts.length > 0 && (
          <View style={styles.alertsSection}>
            <View style={styles.sectionHeaderRow}>
              <MaterialCommunityIcons name="bullhorn-outline" size={22} color={THEME.colors.accent} />
              <Text style={styles.sectionTitle}>{t('priceAlerts')}</Text>
            </View>
            {alerts.map((al, idx) => (
              <TouchableOpacity 
                key={idx}
                onPress={() => onNavigate('pricing')}
                style={styles.alertCard}
                activeOpacity={0.8}
              >
                <View style={styles.alertLeft}>
                  <View style={[styles.alertDot, { backgroundColor: al.color || '#4CAF50' }]} />
                  <Text style={styles.alertItemName}>
                    {language === 'ta' ? al.name_ta : al.name_en}
                  </Text>
                </View>
                {al.festival_tag ? (
                  <View style={styles.festivalBadge}>
                    <Text style={styles.festivalBadgeText}>🎉 {al.festival_tag}</Text>
                  </View>
                ) : (
                  <View style={styles.trendBadge}>
                    <MaterialCommunityIcons name="arrow-up-bold" size={16} color="#E65100" />
                    <Text style={styles.trendText}>
                      {language === 'ta' ? 'விலை உயர்வு' : 'Price Up'}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* QUICK NAVIGATION ACTION BUTTONS */}
        <View style={styles.quickGrid}>
          <Text style={styles.sectionTitle}>{t('quickActions')}</Text>

          <View style={styles.actionsRow}>
            <BigButton
              title={t('tabPricing')}
              subtitle={language === 'ta' ? 'விலை வழிகாட்டி' : 'Smart Selling Price'}
              icon="tag-text"
              color="#0277BD"
              onPress={() => onNavigate('pricing')}
              style={styles.gridBtn}
            />
            <BigButton
              title={t('tabWhereToBuy')}
              subtitle={language === 'ta' ? 'மலிவான சந்தை' : 'Nearest Mandi'}
              icon="map-marker-path"
              color="#2E7D32"
              onPress={() => onNavigate('whereToBuy')}
              style={styles.gridBtn}
            />
          </View>

          <View style={styles.actionsRow}>
            <BigButton
              title={language === 'ta' ? 'சந்தை நேரடி விலை' : 'Live Market Prices'}
              subtitle={language === 'ta' ? 'அகமார்க்நெட் மண்டி நிலவரம்' : 'AGMARKNET Mandi Live'}
              icon="chart-timeline-variant-shimmer"
              color="#00695C"
              onPress={() => onNavigate('marketIntelligence')}
              style={styles.gridBtn}
            />
            <BigButton
              title={language === 'ta' ? 'AI தேவை கணிப்பு' : 'AI Demand Predictor'}
              subtitle={language === 'ta' ? '7 நாள் விற்பனை கணிப்பு' : '7-Day ML Forecast'}
              icon="crystal-ball"
              color="#D97706"
              onPress={() => onNavigate('demandPredictor')}
              style={styles.gridBtn}
            />
          </View>

          <View style={styles.actionsRow}>
            <BigButton
              title={t('tabReports')}
              subtitle={language === 'ta' ? 'லாப அறிக்கை' : 'Sales & Charts'}
              icon="chart-bar"
              color="#6A1B9A"
              onPress={() => onNavigate('reports')}
              style={styles.gridBtn}
            />
          </View>
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
  micSection: {
    alignItems: 'center',
    marginVertical: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: 24,
    paddingHorizontal: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4
  },
  micCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: THEME.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: THEME.colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 8
  },
  micInner: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: THEME.colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center'
  },
  micLabel: {
    fontSize: 22,
    fontWeight: '900',
    color: THEME.colors.primaryDark,
    marginTop: 14,
    letterSpacing: 0.5
  },
  micInstruction: {
    fontSize: 14,
    color: '#4B5563',
    marginTop: 4,
    textAlign: 'center',
    fontWeight: '600'
  },
  dailyEntryBanner: {
    backgroundColor: '#FFFFFF',
    borderRadius: THEME.borderRadius.lg,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: THEME.colors.primary,
    marginBottom: 12,
    elevation: 3,
    shadowColor: THEME.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4
  },
  dailyEntryIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: THEME.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  dailyEntryTextCol: {
    flex: 1
  },
  dailyEntryTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: THEME.colors.primaryDark
  },
  dailyEntrySub: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    marginTop: 2,
    lineHeight: 16
  },
  cardsRow: {
    flexDirection: 'row',
    gap: 12,
    marginVertical: 8
  },
  summaryCard: {
    flex: 1,
    borderRadius: 18,
    padding: 16,
    borderWidth: 2,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2
  },
  profitCardBg: {
    backgroundColor: '#F1F8E9',
    borderColor: '#A5D6A7'
  },
  lossCardBg: {
    backgroundColor: '#FFEBEE',
    borderColor: '#EF9A9A'
  },
  salesCardBg: {
    backgroundColor: '#E1F5FE',
    borderColor: '#81D4FA'
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#374151',
    flex: 1
  },
  profitAmount: {
    fontSize: 30,
    fontWeight: '900',
    marginVertical: 4
  },
  cardSub: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280'
  },
  undoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    borderWidth: 1.5,
    borderColor: '#EF9A9A',
    borderRadius: 14,
    padding: 12,
    marginVertical: 8,
    gap: 12
  },
  undoTextContainer: {
    flex: 1
  },
  undoTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#B71C1C'
  },
  undoSub: {
    fontSize: 12,
    color: '#555'
  },
  alertsSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB'
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111827'
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6'
  },
  alertLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  alertDot: {
    width: 12,
    height: 12,
    borderRadius: 6
  },
  alertItemName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827'
  },
  festivalBadge: {
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFE0B2'
  },
  festivalBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#E65100'
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8E1',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12
  },
  trendText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#E65100',
    marginLeft: 2
  },
  quickGrid: {
    marginVertical: 12
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginVertical: 4
  },
  gridBtn: {
    flex: 1
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4
  },
  profileTopRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  shopAvatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: THEME.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2
  },
  profileShopName: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111827'
  },
  profileDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 3
  },
  profileVendorName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4B5563'
  },
  profilePhone: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
    marginLeft: 4
  },
  profileActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6'
  },
  profileActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  profileActionText: {
    fontSize: 12,
    fontWeight: '800',
    color: THEME.colors.primary
  }
});
