import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { THEME } from '../constants/theme';
import { useLanguage } from '../context/LanguageContext';
import { useVoice } from '../hooks/useVoice';
import { api } from '../api/client';
import { Header } from '../components/Header';
import { BigButton } from '../components/BigButton';
import { QuickItemGrid } from '../components/QuickItemGrid';

export const PurchasesScreen = ({ onNavigate }) => {
  const { t, language } = useLanguage();
  const { speak } = useVoice();
  const [items, setItems] = useState([]);
  const [markets, setMarkets] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedMarketId, setSelectedMarketId] = useState(1);
  const [quantity, setQuantity] = useState('20');
  const [totalCost, setTotalCost] = useState('600');
  const [notes, setNotes] = useState('');
  const [recentPurchases, setRecentPurchases] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  const loadData = async () => {
    try {
      const itms = await api.getItems();
      setItems(itms);
      if (itms.length > 0) setSelectedItem(itms[0]);

      const mkts = await api.getMarkets();
      setMarkets(mkts);

      const purs = await api.getPurchases();
      setRecentPurchases(purs);
    } catch (e) {
      console.warn("Failed to load purchase screen data", e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSavePurchase = async () => {
    if (!selectedItem) return;
    const qty = parseFloat(quantity) || 1.0;
    const cost = parseFloat(totalCost) || 0.0;

    if (cost <= 0) {
      const err = language === 'ta' ? 'வாங்கிய தொகையை உள்ளிடவும்' : 'Please enter total buying cost';
      speak(err);
      return;
    }

    setIsSaving(true);
    try {
      const res = await api.createPurchase({
        user_id: 1,
        item_id: selectedItem.id,
        market_id: selectedMarketId,
        quantity: qty,
        unit: selectedItem.default_unit,
        total_cost: cost,
        notes: notes || null
      });

      const itemName = language === 'ta' ? selectedItem.name_ta : selectedItem.name_en;
      const confirmText = language === 'ta' ?
        `${qty} ${selectedItem.default_unit} ${itemName} ₹${cost}-க்கு கொள்முதல் பதிவு செய்யப்பட்டது` :
        `Saved purchase of ${qty} ${selectedItem.default_unit} ${itemName} for ₹${cost}`;
      
      speak(confirmText);
      await loadData();
      setNotes('');
    } catch (e) {
      console.warn("Failed to save purchase", e);
    } finally {
      setIsSaving(false);
    }
  };

  const unitCost = (parseFloat(totalCost) && parseFloat(quantity)) ? 
    (parseFloat(totalCost) / parseFloat(quantity)).toFixed(1) : 0;

  return (
    <View style={styles.screen}>
      <Header title={t('purchasesTitle')} showBack onBack={() => onNavigate('home')} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* VOICE SHORTCUT FOR PURCHASES */}
        <TouchableOpacity
          onPress={() => onNavigate('voice')}
          style={styles.voicePromptCard}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="microphone" size={26} color="#FFFFFF" />
          <View style={{ flex: 1 }}>
            <Text style={styles.voicePromptTitle}>
              {language === 'ta' ? 'குரல் மூலமும் பதிவு செய்யலாம்' : 'Or Speak to Record Purchase'}
            </Text>
            <Text style={styles.voicePromptSub}>
              {language === 'ta' ? '"20 கிலோ உருளைக்கிழங்கு 500 ரூபாய் வாங்கினேன்"' : '"Bought 20 kg potato for 500 rs"'}
            </Text>
          </View>
        </TouchableOpacity>

        {/* STEP 1: SELECT ITEM */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeader}>{t('selectItem')}</Text>
          <QuickItemGrid
            items={items}
            selectedId={selectedItem ? selectedItem.id : null}
            onSelect={(it) => setSelectedItem(it)}
            numColumns={2}
          />
        </View>

        {/* STEP 2: QUANTITY & TOTAL COST INPUTS */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeader}>
            {selectedItem ? (language === 'ta' ? selectedItem.name_ta : selectedItem.name_en) : t('item')}
          </Text>

          <View style={styles.inputGrid}>
            {/* Quantity */}
            <View style={styles.inputCol}>
              <Text style={styles.inputLabel}>
                {t('quantity')} ({selectedItem ? selectedItem.default_unit : 'kg'})
              </Text>
              <TextInput
                style={styles.bigInput}
                keyboardType="numeric"
                value={quantity}
                onChangeText={setQuantity}
                placeholder="20"
              />
            </View>

            {/* Total Buying Cost */}
            <View style={styles.inputCol}>
              <Text style={styles.inputLabel}>{t('buyingCost')}</Text>
              <TextInput
                style={[styles.bigInput, { color: THEME.colors.purchasesOrange }]}
                keyboardType="numeric"
                value={totalCost}
                onChangeText={setTotalCost}
                placeholder="600"
              />
            </View>
          </View>

          {/* Unit Cost Pill */}
          <View style={styles.unitCostBadge}>
            <MaterialCommunityIcons name="calculator" size={20} color="#E65100" />
            <Text style={styles.unitCostText}>
              {t('unitCost')}: ₹{unitCost} / {selectedItem ? selectedItem.default_unit : 'kg'}
            </Text>
          </View>
        </View>

        {/* STEP 3: SELECT MARKET */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeader}>{t('selectMarket')}</Text>
          <View style={styles.marketChipsRow}>
            {markets.map((m) => (
              <TouchableOpacity
                key={m.id}
                onPress={() => setSelectedMarketId(m.id)}
                style={[
                  styles.marketChip,
                  selectedMarketId === m.id && styles.selectedMarketChip
                ]}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons 
                  name="storefront-outline" 
                  size={18} 
                  color={selectedMarketId === m.id ? '#1B5E20' : '#4B5563'} 
                />
                <Text style={[
                  styles.marketChipText,
                  selectedMarketId === m.id && styles.selectedMarketChipText
                ]}>
                  {language === 'ta' ? m.name_ta.split(' ')[0] : m.name_en.split(' ')[0]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* SAVE BUTTON */}
        <BigButton
          title={t('savePurchase')}
          icon="check-circle"
          color={THEME.colors.purchasesOrange}
          onPress={handleSavePurchase}
          size="giant"
          disabled={isSaving}
        />

        {/* RECENT PURCHASES LOG */}
        {recentPurchases.length > 0 && (
          <View style={styles.historyCard}>
            <Text style={styles.historyTitle}>{t('purchaseHistory')}</Text>
            {recentPurchases.slice(0, 5).map((p, idx) => (
              <View key={idx} style={styles.historyRow}>
                <View style={styles.historyLeft}>
                  <Text style={styles.historyItemName}>
                    {language === 'ta' ? (p.item_name_ta || 'பொருள்') : (p.item_name_en || 'Item')}
                  </Text>
                  <Text style={styles.historySub}>
                    {p.quantity} {p.unit} • {p.purchase_date}
                  </Text>
                </View>
                <Text style={styles.historyCost}>₹{p.total_cost}</Text>
              </View>
            ))}
          </View>
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
  voicePromptCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.purchasesOrange,
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    gap: 12
  },
  voicePromptTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800'
  },
  voicePromptSub: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB'
  },
  sectionHeader: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 10
  },
  inputGrid: {
    flexDirection: 'row',
    gap: 12
  },
  inputCol: {
    flex: 1
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4B5563',
    marginBottom: 6
  },
  bigInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 2,
    borderColor: '#D1D5DB',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 22,
    fontWeight: '900',
    color: '#111827',
    textAlign: 'center'
  },
  unitCostBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    padding: 10,
    marginTop: 12,
    gap: 6
  },
  unitCostText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#E65100'
  },
  marketChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  marketChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    gap: 6
  },
  selectedMarketChip: {
    backgroundColor: '#E8F5E9',
    borderColor: THEME.colors.primary
  },
  marketChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151'
  },
  selectedMarketChipText: {
    color: THEME.colors.primary,
    fontWeight: '900'
  },
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB'
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 10
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6'
  },
  historyLeft: {
    flex: 1
  },
  historyItemName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827'
  },
  historySub: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2
  },
  historyCost: {
    fontSize: 16,
    fontWeight: '900',
    color: THEME.colors.purchasesOrange
  }
});
