import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, RefreshControl } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { THEME } from '../constants/theme';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../api/client';
import { Header } from '../components/Header';
import { DailyReportModal } from './DailyReportModal';

export const ReportsScreen = ({ onNavigate }) => {
  const { t, language } = useLanguage();
  const [period, setPeriod] = useState('daily'); // 'daily' | 'weekly' | 'monthly'
  const [reportData, setReportData] = useState({
    total_sales: 0,
    total_purchases: 0,
    net_profit: 0,
    profit_margin_pct: 0,
    chart_data: [],
    top_selling_items: []
  });
  const [historyList, setHistoryList] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchReports = async (p) => {
    setLoading(true);
    try {
      const data = await api.getReports(p);
      setReportData(data);

      const history = await api.getDailyReportsHistory(14);
      setHistoryList(history || []);
    } catch (e) {
      console.warn("Failed to load reports", e);
    } finally {
      setLoading(false);
    }
  };

  const openReportForDate = async (date) => {
    try {
      const rep = await api.getDailySalesReport(date);
      setSelectedReport(rep);
      setReportModalVisible(true);
    } catch (e) {
      console.warn("Failed to fetch report for date", date, e);
    }
  };

  useEffect(() => {
    fetchReports(period);
  }, [period]);

  const maxVal = Math.max(
    ...reportData.chart_data.map(d => Math.max(d.sales || 0, d.purchases || 0)),
    100
  );

  const isProfitPositive = reportData.net_profit >= 0;

  return (
    <View style={styles.screen}>
      <Header title={t('reportsTitle')} showBack onBack={() => onNavigate('home')} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => fetchReports(period)} />}
      >
        {/* PERIOD SELECTOR TABS & REFRESH */}
        <View style={styles.tabsRow}>
          <View style={styles.tabsContainer}>
            {['daily', 'weekly', 'monthly'].map((p) => {
              const isSelected = period === p;
              let tabLabel = t('dailyTab') || 'Daily';
              if (p === 'weekly') tabLabel = t('weeklyTab') || 'Weekly';
              if (p === 'monthly') tabLabel = t('monthlyTab') || 'Monthly';

              return (
                <TouchableOpacity
                  key={p}
                  onPress={() => setPeriod(p)}
                  style={[styles.tabBtn, isSelected && styles.tabBtnActive]}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.tabBtnText, isSelected && styles.tabBtnTextActive]}>
                    {tabLabel.split(' ')[0]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity
            onPress={() => fetchReports(period)}
            style={styles.refreshIconBtn}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="refresh" size={22} color={THEME.colors.primary} />
          </TouchableOpacity>
        </View>

        {/* 3 SUMMARY CARDS */}
        <View style={styles.statsCard}>
          {/* Net Profit Big Banner */}
          <View style={[
            styles.profitBanner, 
            isProfitPositive ? styles.profitBg : styles.lossBg
          ]}>
            <View style={styles.bannerRow}>
              <MaterialCommunityIcons 
                name={isProfitPositive ? "trophy" : "alert-circle"} 
                size={28} 
                color={isProfitPositive ? THEME.colors.profit : THEME.colors.loss} 
              />
              <Text style={styles.profitBannerLabel}>
                {isProfitPositive ? t('netProfit') : t('netLoss')}
              </Text>
            </View>
            <Text style={[
              styles.profitBannerAmount, 
              { color: isProfitPositive ? THEME.colors.profit : THEME.colors.loss }
            ]}>
              ₹{reportData.net_profit}
            </Text>
            <Text style={styles.profitMarginText}>
              {t('margin')}: {reportData.profit_margin_pct}%
            </Text>
          </View>

          {/* Sales & Purchases Side by Side */}
          <View style={styles.breakdownRow}>
            <View style={[styles.miniStatBox, { borderLeftColor: THEME.colors.salesBlue }]}>
              <Text style={styles.miniStatLabel}>{t('totalSales')}</Text>
              <Text style={[styles.miniStatValue, { color: THEME.colors.salesBlue }]}>
                ₹{reportData.total_sales}
              </Text>
            </View>

            <View style={[styles.miniStatBox, { borderLeftColor: THEME.colors.purchasesOrange }]}>
              <Text style={styles.miniStatLabel}>{t('totalBuyingCost')}</Text>
              <Text style={[styles.miniStatValue, { color: THEME.colors.purchasesOrange }]}>
                ₹{reportData.total_purchases}
              </Text>
            </View>
          </View>
        </View>

        {/* ACCESSIBLE HIGH-CONTRAST BAR CHART */}
        <View style={styles.chartCard}>
          <View style={styles.chartTitleRow}>
            <MaterialCommunityIcons name="chart-box" size={22} color={THEME.colors.primary} />
            <Text style={styles.chartTitle}>{t('salesVsCostChart')}</Text>
          </View>

          {/* Legend */}
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendBox, { backgroundColor: THEME.colors.salesBlue }]} />
              <Text style={styles.legendText}>{t('totalSales')}</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendBox, { backgroundColor: THEME.colors.purchasesOrange }]} />
              <Text style={styles.legendText}>{t('totalBuyingCost')}</Text>
            </View>
          </View>

          {/* Bars */}
          <View style={styles.barsContainer}>
            {reportData.chart_data.map((item, idx) => {
              const salesHeight = Math.max((item.sales / maxVal) * 120, 6);
              const purchasesHeight = Math.max((item.purchases / maxVal) * 120, 6);

              return (
                <View key={idx} style={styles.barCol}>
                  <View style={styles.barsPair}>
                    {/* Sales Bar */}
                    <View style={[styles.bar, { height: salesHeight, backgroundColor: THEME.colors.salesBlue }]} />
                    {/* Purchases Bar */}
                    <View style={[styles.bar, { height: purchasesHeight, backgroundColor: THEME.colors.purchasesOrange }]} />
                  </View>
                  <Text style={styles.barLabel}>{item.label}</Text>
                  <Text style={styles.barProfit}>₹{item.profit}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* TOP SELLING ITEMS */}
        {reportData.top_selling_items.length > 0 && (
          <View style={styles.topItemsCard}>
            <View style={styles.chartTitleRow}>
              <MaterialCommunityIcons name="star-circle" size={22} color="#F57F17" />
              <Text style={styles.chartTitle}>{t('topSellingItems')}</Text>
            </View>

            {reportData.top_selling_items.map((it, idx) => (
              <View key={idx} style={styles.topItemRow}>
                <View style={[styles.topRankCircle, { backgroundColor: idx === 0 ? '#FFD54F' : '#ECEFF1' }]}>
                  <Text style={styles.topRankText}>#{idx + 1}</Text>
                </View>
                <View style={styles.topItemInfo}>
                  <Text style={styles.topItemName}>
                    {language === 'ta' ? it.name_ta : it.name_en}
                  </Text>
                  <Text style={styles.topItemQty}>
                    {it.total_qty} {it.unit}
                  </Text>
                </View>
                <Text style={styles.topItemRevenue}>₹{it.total_revenue}</Text>
              </View>
            ))}
          </View>
        )}
        {/* PREVIOUS DAILY REPORTS HISTORY */}
        <View style={styles.historySection}>
          <View style={styles.chartTitleRow}>
            <MaterialCommunityIcons name="history" size={24} color={THEME.colors.primary} />
            <Text style={styles.chartTitle}>{t('revisitPreviousReports')}</Text>
          </View>

          {historyList.length === 0 ? (
            <View style={styles.emptyHistoryBox}>
              <Text style={styles.emptyHistoryText}>
                {language === 'ta' ? 'இன்னும் தினசரி அறிக்கை பதிவு செய்யப்படவில்லை.' : 'No daily reports logged yet.'}
              </Text>
              <TouchableOpacity
                onPress={() => onNavigate('dailySalesEntry')}
                style={styles.logTodayBtn}
              >
                <Text style={styles.logTodayBtnText}>{t('logDailySales')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            historyList.map((h, idx) => (
              <TouchableOpacity
                key={idx}
                onPress={() => openReportForDate(h.date)}
                style={styles.historyCard}
                activeOpacity={0.8}
              >
                <View style={styles.historyCardLeft}>
                  <Text style={styles.historyDate}>{h.date}</Text>
                  <Text style={styles.historySub}>
                    {t('revenue')}: ₹{h.total_sales_revenue} • {t('profitMargin')}: {h.profit_margin_pct}%
                  </Text>
                </View>
                <View style={styles.historyCardRight}>
                  <Text style={styles.historyProfit}>₹{h.net_profit}</Text>
                  <Text style={styles.historyProfitLabel}>{t('netProfit')}</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={24} color="#9CA3AF" />
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      {/* DETAILED DAILY REPORT MODAL */}
      <DailyReportModal
        visible={reportModalVisible}
        onClose={() => setReportModalVisible(false)}
        reportData={selectedReport}
      />
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
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16
  },
  tabsContainer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#E5E7EB',
    borderRadius: 16,
    padding: 4
  },
  refreshIconBtn: {
    backgroundColor: '#FFFFFF',
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#E5E7EB'
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 12
  },
  tabBtnActive: {
    backgroundColor: '#FFFFFF',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2
  },
  tabBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4B5563'
  },
  tabBtnTextActive: {
    color: THEME.colors.primary,
    fontWeight: '900'
  },
  statsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB'
  },
  profitBanner: {
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    marginBottom: 14
  },
  profitBg: {
    backgroundColor: '#F1F8E9'
  },
  lossBg: {
    backgroundColor: '#FFEBEE'
  },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  profitBannerLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: '#374151'
  },
  profitBannerAmount: {
    fontSize: 38,
    fontWeight: '900',
    marginVertical: 4
  },
  profitMarginText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4B5563'
  },
  breakdownRow: {
    flexDirection: 'row',
    gap: 12
  },
  miniStatBox: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 4
  },
  miniStatLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280'
  },
  miniStatValue: {
    fontSize: 20,
    fontWeight: '900',
    marginTop: 2
  },
  chartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB'
  },
  chartTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827'
  },
  legendRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  legendBox: {
    width: 12,
    height: 12,
    borderRadius: 3
  },
  legendText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4B5563'
  },
  barsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 170,
    paddingTop: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 6
  },
  barCol: {
    alignItems: 'center',
    flex: 1
  },
  barsPair: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    marginBottom: 6
  },
  bar: {
    width: 14,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4
  },
  barLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#374151',
    marginTop: 4
  },
  barProfit: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1B5E20',
    marginTop: 1
  },
  topItemsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB'
  },
  topItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6'
  },
  topRankCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  topRankText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#111827'
  },
  topItemInfo: {
    flex: 1
  },
  topItemName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827'
  },
  topItemQty: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 2
  },
  topItemRevenue: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1B5E20'
  },
  historySection: {
    marginTop: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB'
  },
  emptyHistoryBox: {
    paddingVertical: 20,
    alignItems: 'center'
  },
  emptyHistoryText: {
    fontSize: 14,
    color: THEME.colors.textMuted,
    textAlign: 'center',
    marginBottom: 12
  },
  logTodayBtn: {
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 14
  },
  logTodayBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14
  },
  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6'
  },
  historyCardLeft: {
    flex: 1
  },
  historyDate: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.colors.textDark
  },
  historySub: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2
  },
  historyCardRight: {
    alignItems: 'flex-end',
    marginRight: 8
  },
  historyProfit: {
    fontSize: 16,
    fontWeight: '900',
    color: THEME.colors.primary
  },
  historyProfitLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6B7280'
  }
});
