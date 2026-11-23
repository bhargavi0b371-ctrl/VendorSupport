import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { THEME } from '../constants/theme';
import { useLanguage } from '../context/LanguageContext';

export const PriceTrendChart = ({ trendData }) => {
  const { language } = useLanguage();
  if (!trendData || !trendData.historical_points || trendData.historical_points.length === 0) {
    return null;
  }

  const points = trendData.historical_points;
  const prices = points.map(p => p.modal_price);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const range = (maxP - minP) > 0 ? (maxP - minP) : 1;

  // Take the last 10 points for readable bar columns
  const displayPoints = points.slice(-10);

  const getPatternBadge = () => {
    switch (trendData.trend_pattern) {
      case 'increasing':
        return {
          icon: 'trending-up',
          color: '#B91C1C',
          bgColor: '#FEE2E2',
          label: language === 'ta' ? 'விலை உயர்கிறது (Up)' : 'Price Increasing'
        };
      case 'decreasing':
        return {
          icon: 'trending-down',
          color: '#15803D',
          bgColor: '#DCFCE7',
          label: language === 'ta' ? 'விலை குறைகிறது (Down)' : 'Price Decreasing'
        };
      case 'volatile':
        return {
          icon: 'swap-vertical',
          color: '#B45309',
          bgColor: '#FEF3C7',
          label: language === 'ta' ? 'நிலையற்ற மாறுபாடு' : 'Volatile Swings'
        };
      default:
        return {
          icon: 'minus',
          color: '#4B5563',
          bgColor: '#F3F4F6',
          label: language === 'ta' ? 'நிலையான விலை' : 'Stable Price'
        };
    }
  };

  const badge = getPatternBadge();

  return (
    <View style={styles.container}>
      {/* Header: Trend Summary */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.chartTitle}>
            {language === 'ta' ? 'விலை வரலாற்று போக்கு' : 'Wholesale Price Trend'}
          </Text>
          <Text style={styles.marketSub}>{trendData.market_name_en} • {trendData.period_days} Days</Text>
        </View>

        <View style={[styles.patternBadge, { backgroundColor: badge.bgColor }]}>
          <MaterialCommunityIcons name={badge.icon} size={16} color={badge.color} />
          <Text style={[styles.patternLabel, { color: badge.color }]}>{badge.label}</Text>
        </View>
      </View>

      {/* Stats Summary Strip */}
      <View style={styles.statsStrip}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>{language === 'ta' ? 'தற்போதைய விலை' : 'Current'}</Text>
          <Text style={styles.statValue}>₹{trendData.current_price}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>{language === 'ta' ? 'சராசரி' : 'Average'}</Text>
          <Text style={styles.statValue}>₹{trendData.average_price}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>{language === 'ta' ? 'நாளை கணிப்பு' : 'Projected'}</Text>
          <Text style={[styles.statValue, { color: THEME.colors.primary }]}>
            ₹{trendData.projected_tomorrow_price}
          </Text>
        </View>
      </View>

      {/* Accessible Bar Chart */}
      <View style={styles.chartArea}>
        {displayPoints.map((pt, idx) => {
          const heightPct = Math.max(15, Math.round(((pt.modal_price - minP) / range) * 75 + 20));
          const isLatest = idx === displayPoints.length - 1;
          const dayLabel = pt.date.slice(8); // 'DD'

          return (
            <View key={pt.date + idx} style={styles.barCol}>
              <Text style={styles.barPriceText}>₹{pt.modal_price}</Text>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    {
                      height: `${heightPct}%`,
                      backgroundColor: isLatest ? THEME.colors.primary : '#93C5FD'
                    }
                  ]}
                />
              </View>
              <Text style={[styles.barDateText, isLatest && styles.latestDateText]}>
                {dayLabel}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Margin Opportunities Section */}
      {trendData.margin_opportunities && trendData.margin_opportunities.length > 0 && (
        <View style={styles.opportunitiesBox}>
          <View style={styles.oppTitleRow}>
            <MaterialCommunityIcons name="lightbulb-on" size={18} color="#D97706" />
            <Text style={styles.oppTitle}>
              {language === 'ta' ? 'லாபத்தை உயர்த்த வாய்ப்புகள்' : 'Margin Opportunities'}
            </Text>
          </View>
          {(language === 'ta' ? trendData.margin_opportunities_ta : trendData.margin_opportunities).map((tip, i) => (
            <Text key={i} style={styles.oppItem}>• {tip}</Text>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 3
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827'
  },
  marketSub: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
    marginTop: 2
  },
  patternBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8
  },
  patternLabel: {
    fontSize: 11,
    fontWeight: '800'
  },
  statsStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 16
  },
  statItem: {
    alignItems: 'center'
  },
  statLabel: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600'
  },
  statValue: {
    fontSize: 16,
    fontWeight: '900',
    color: '#111827',
    marginTop: 2
  },
  chartArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 140,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    marginBottom: 8
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: '100%',
    paddingHorizontal: 2
  },
  barPriceText: {
    fontSize: 9,
    color: '#6B7280',
    fontWeight: '700',
    marginBottom: 4
  },
  barTrack: {
    flex: 1,
    width: 14,
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
    justifyContent: 'flex-end',
    overflow: 'hidden'
  },
  barFill: {
    width: '100%',
    borderRadius: 6
  },
  barDateText: {
    fontSize: 10,
    color: '#9CA3AF',
    fontWeight: '600',
    marginTop: 4
  },
  latestDateText: {
    color: THEME.colors.primary,
    fontWeight: '900'
  },
  opportunitiesBox: {
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#FDE68A'
  },
  oppTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6
  },
  oppTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#92400E'
  },
  oppItem: {
    fontSize: 12,
    color: '#78350F',
    lineHeight: 18,
    marginBottom: 4
  }
});
