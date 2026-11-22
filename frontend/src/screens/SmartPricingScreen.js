import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { THEME } from '../constants/theme';
import { useLanguage } from '../context/LanguageContext';
import { useVoice } from '../hooks/useVoice';
import { api } from '../api/client';
import { Header } from '../components/Header';
import { BigButton } from '../components/BigButton';

export const SmartPricingScreen = ({ onNavigate }) => {
  const { t, language } = useLanguage();
  const { speak } = useVoice();
  const [pricings, setPricings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedItemForOverride, setSelectedItemForOverride] = useState(null);
  const [manualPriceInput, setManualPriceInput] = useState('');

  const loadPricing = async () => {
    setLoading(true);
    try {
      const data = await api.getSmartPricing();
      setPricings(data);
    } catch (e) {
      console.warn("Failed to load smart pricing", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPricing();
  }, []);

  const handleSpeakPrice = (item) => {
    const festTextEn = item.festival_tag ? ` with ${item.festival_tag}` : '';
    const festTextTa = item.festival_tag ? ` (${item.festival_tag})` : '';

    const textEn = `Wholesale cost for ${item.name_en} is ₹${item.wholesale_cost}. Suggested selling price is ₹${item.suggested_selling_price}${festTextEn}.`;
    const textTa = `${item.name_ta} மொத்த விலை ₹${item.wholesale_cost}. விற்க வேண்டிய விலை ₹${item.suggested_selling_price}${festTextTa}.`;

    speak(language === 'ta' ? textTa : textEn);
  };

  const handleQuickSale = async (item) => {
    try {
      const res = await api.createSale({
        user_id: 1,
        item_id: item.item_id,
        quantity: 1.0,
        unit: item.unit,
        amount: item.suggested_selling_price,
        voice_raw_text: `Quick sale 1 ${item.unit} ${item.name_en} at suggested price ₹${item.suggested_selling_price}`
      });

      const confirmText = language === 'ta' ?
        `1 ${item.unit} ${item.name_ta} ₹${item.suggested_selling_price}-க்கு விற்பனை பதிவு செய்யப்பட்டது` :
        `Recorded 1 ${item.unit} ${item.name_en} for ₹${item.suggested_selling_price}`;
      speak(confirmText);
    } catch (e) {
      console.warn("Quick sale failed", e);
    }
  };

  const handleManualPriceSave = async () => {
    if (!selectedItemForOverride) return;
    const price = parseFloat(manualPriceInput);
    if (!price || price <= 0) return;

    try {
      await api._request('/api/pricing/manual-price', {
        method: 'POST',
        body: JSON.stringify({
          item_id: selectedItemForOverride.item_id,
          market_id: 1,
          date: new Date().toISOString().split('T')[0],
          modal_price: price,
          source: 'manual_entry'
        })
      });
      setSelectedItemForOverride(null);
      setManualPriceInput('');
      await loadPricing();

      const msg = language === 'ta' ? 'மொத்த விலை புதுப்பிக்கப்பட்டது' : 'Wholesale price updated';
      speak(msg);
    } catch (e) {
      console.warn("Manual price save failed", e);
    }
  };

  return (
    <View style={styles.screen}>
      <Header title={t('smartPricingTitle')} showBack onBack={() => onNavigate('home')} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* FORMULA BANNER */}
        <View style={styles.formulaBanner}>
          <MaterialCommunityIcons name="calculator-variant" size={24} color="#1565C0" />
          <View style={{ flex: 1 }}>
            <Text style={styles.formulaTitle}>
              {language === 'ta' ? 'விலை நிர்ணய சூத்திரம்:' : 'Fair Price Formula:'}
            </Text>
            <Text style={styles.formulaText}>
              {language === 'ta' ? 
                'மொத்த விலை + உங்கள் லாபம் (25%) + பண்டிகை தேவை%' : 
                'Wholesale Mandi Rate + Margin (25%) + Festival Demand%'}
            </Text>
          </View>
        </View>

        {/* PRICING ITEMS LIST */}
        {pricings.map((p) => {
          const isUp = p.price_trend === 'up';
          const isDown = p.price_trend === 'down';

          return (
            <View key={p.item_id} style={styles.pricingCard}>
              <View style={styles.cardTopRow}>
                {/* Left: Item identity */}
                <View style={styles.itemTitleRow}>
                  <View style={[styles.itemDot, { backgroundColor: p.color || '#4CAF50' }]} />
                  <View>
                    <Text style={styles.itemName}>
                      {language === 'ta' ? p.name_ta : p.name_en}
                    </Text>
                    <Text style={styles.itemSecondaryName}>
                      {language === 'ta' ? p.name_en : p.name_ta} • per {p.unit}
                    </Text>
                  </View>
                </View>

                {/* Right: Audio Speak button */}
                <TouchableOpacity 
                  onPress={() => handleSpeakPrice(p)}
                  style={styles.speakPill}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons name="volume-high" size={22} color={THEME.colors.primary} />
                </TouchableOpacity>
              </View>

              {/* FESTIVAL TAG (if active) */}
              {p.festival_tag && (
                <View style={styles.festivalBanner}>
                  <MaterialCommunityIcons name="party-popper" size={18} color="#E65100" />
                  <Text style={styles.festivalTagText}>
                    {p.festival_tag}
                  </Text>
                </View>
              )}

              {/* MAIN NUMBERS COMPARISON */}
              <View style={styles.numbersGrid}>
                {/* Wholesale Cost */}
                <View style={styles.numberCol}>
                  <Text style={styles.numLabel}>{t('todayWholesale')}</Text>
                  <Text style={styles.costVal}>₹{p.wholesale_cost}</Text>
                  <TouchableOpacity 
                    onPress={() => {
                      setSelectedItemForOverride(p);
                      setManualPriceInput(p.wholesale_cost.toString());
                    }}
                    style={styles.overrideLink}
                  >
                    <Text style={styles.overrideLinkText}>
                      {language === 'ta' ? 'மாற்ற ✏️' : 'Edit ✏️'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Arrow */}
                <MaterialCommunityIcons name="arrow-right-bold" size={24} color="#9CA3AF" />

                {/* Suggested Selling Price */}
                <View style={styles.numberCol}>
                  <Text style={styles.numLabel}>{t('suggestedSelling')}</Text>
                  <Text style={styles.suggestedVal}>₹{p.suggested_selling_price}</Text>
                  <View style={styles.trendRow}>
                    <MaterialCommunityIcons 
                      name={isUp ? "arrow-up" : (isDown ? "arrow-down" : "minus")} 
                      size={14} 
                      color={isUp ? "#C62828" : (isDown ? "#2E7D32" : "#6B7280")} 
                    />
                    <Text style={[styles.trendText, { color: isUp ? "#C62828" : (isDown ? "#2E7D32" : "#6B7280") }]}>
                      {isUp ? t('trendUp') : (isDown ? t('trendDown') : t('trendStable'))}
                    </Text>
                  </View>
                </View>
              </View>

              {/* BOTTOM ACTIONS */}
              <View style={styles.cardActionsRow}>
                <TouchableOpacity 
                  onPress={() => handleQuickSale(p)}
                  style={styles.quickSaleBtn}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons name="plus-circle" size={18} color="#FFFFFF" />
                  <Text style={styles.quickSaleBtnText}>
                    {language === 'ta' ? `₹${p.suggested_selling_price}-க்கு 1 ${p.unit} விற்க` : `Log 1 ${p.unit} @ ₹${p.suggested_selling_price}`}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  onPress={() => onNavigate('whereToBuy')}
                  style={styles.whereToBuyLink}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons name="map-marker-radius" size={18} color="#0277BD" />
                  <Text style={styles.whereToBuyLinkText}>{t('tabWhereToBuy')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        {/* MANUAL PRICE OVERRIDE MODAL */}
        {selectedItemForOverride && (
          <Modal
            transparent
            animationType="fade"
            visible={!!selectedItemForOverride}
            onRequestClose={() => setSelectedItemForOverride(null)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>{t('manualPriceEntry')}</Text>
                <Text style={styles.modalSubtitle}>
                  {language === 'ta' ? selectedItemForOverride.name_ta : selectedItemForOverride.name_en}
                </Text>

                <Text style={styles.modalInputLabel}>{t('updatePrice')} (₹/{selectedItemForOverride.unit}):</Text>
                <TextInput
                  style={styles.modalInput}
                  keyboardType="numeric"
                  value={manualPriceInput}
                  onChangeText={setManualPriceInput}
                  placeholder="30"
                  autoFocus
                />

                <View style={styles.modalBtnRow}>
                  <TouchableOpacity 
                    onPress={() => setSelectedItemForOverride(null)}
                    style={styles.modalCancelBtn}
                  >
                    <Text style={styles.modalCancelText}>{t('cancel')}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    onPress={handleManualPriceSave}
                    style={styles.modalSaveBtn}
                  >
                    <Text style={styles.modalSaveText}>{t('save')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        )}
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
  formulaBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#90CAF9',
    gap: 12
  },
  formulaTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0D47A1'
  },
  formulaText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1565C0',
    marginTop: 2
  },
  pricingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  itemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  itemDot: {
    width: 14,
    height: 14,
    borderRadius: 7
  },
  itemName: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111827'
  },
  itemSecondaryName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280'
  },
  speakPill: {
    backgroundColor: '#E8F5E9',
    padding: 8,
    borderRadius: 20
  },
  festivalBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: '#FFE0B2',
    gap: 6
  },
  festivalTagText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#E65100'
  },
  numbersGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 14,
    marginVertical: 10
  },
  numberCol: {
    alignItems: 'center'
  },
  numLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280'
  },
  costVal: {
    fontSize: 22,
    fontWeight: '900',
    color: '#374151',
    marginVertical: 2
  },
  suggestedVal: {
    fontSize: 30,
    fontWeight: '900',
    color: THEME.colors.primary,
    marginVertical: 2
  },
  overrideLink: {
    marginTop: 2
  },
  overrideLinkText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1565C0'
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2
  },
  trendText: {
    fontSize: 11,
    fontWeight: '700'
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    gap: 10
  },
  quickSaleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.primary,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 6
  },
  quickSaleBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800'
  },
  whereToBuyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    gap: 4
  },
  whereToBuyLinkText: {
    color: '#0277BD',
    fontSize: 13,
    fontWeight: '700'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    elevation: 8
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111827'
  },
  modalSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 14
  },
  modalInputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 6
  },
  modalInput: {
    borderWidth: 2,
    borderColor: '#D1D5DB',
    borderRadius: 14,
    padding: 12,
    fontSize: 22,
    fontWeight: '900',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 18
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 12
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center'
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#4B5563'
  },
  modalSaveBtn: {
    flex: 1,
    backgroundColor: THEME.colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center'
  },
  modalSaveText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF'
  }
});
