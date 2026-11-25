import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { THEME } from '../constants/theme';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../api/client';
import { LocalDB } from '../db/localDb';
import { Header } from '../components/Header';

export const OnboardingScreen = ({ onComplete, onNavigate, isEditMode = false }) => {
  const { t, language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Catalog data from server or offline
  const [categories, setCategories] = useState([]);
  const [allProducts, setAllProducts] = useState([]);

  // Selections
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedProductIds, setSelectedProductIds] = useState(new Set());
  const [customProducts, setCustomProducts] = useState([]);

  // Modal for adding custom product
  const [modalVisible, setModalVisible] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customCategory, setCustomCategory] = useState('vegetables');
  const [customUnit, setCustomUnit] = useState('kg');

  const unitOptions = [
    { key: 'kg', label: 'kg (கிலோ)' },
    { key: 'gram', label: 'gram (கிராம்)' },
    { key: 'piece', label: 'piece (எண்ணிக்கை)' },
    { key: 'litre', label: 'litre (லிட்டர்)' },
    { key: 'packet', label: 'packet (பாக்கெட்)' },
    { key: 'dozen', label: 'dozen (டஜன்)' },
    { key: 'bunch', label: 'bunch (கட்டு)' },
    { key: 'cup', label: 'cup (கப்)' },
    { key: 'plate', label: 'plate (பிளேட்)' }
  ];

  const isProductInCat = (p, catId) => {
    if (!p) return false;
    const cat = (p.category || '').toLowerCase().trim();
    const cId = (catId || '').toLowerCase().trim();
    if (cId === 'fruits_vegetables') {
      return cat.includes('fruit') || cat.includes('veg');
    }
    if (cId === 'fruits' || cId === 'fruit') return cat.includes('fruit');
    if (cId === 'vegetables' || cId === 'vegetable') return cat.includes('veg') || cat === 'herb';
    if (cId === 'flowers' || cId === 'flower') return cat.includes('flower');
    if (cId === 'street_food' || cId === 'streetfood') return cat.includes('street') || cat.includes('snack') || cat.includes('food');
    if (cId === 'tea_coffee' || cId === 'teacoffee') return cat.includes('tea') || cat.includes('coffee') || cat.includes('beverage');
    if (cId === 'groceries' || cId === 'grocery') return cat.includes('groc');
    if (cId === 'clothes' || cId === 'clothes_accessories' || cId === 'clothing') return cat.includes('cloth') || cat.includes('wear') || cat.includes('access');
    return cat === cId;
  };

  useEffect(() => {
    loadCatalog();
  }, []);

  const loadCatalog = async () => {
    setLoading(true);
    try {
      const catalog = await api.getOnboardingCatalog();
      setCategories(catalog.categories || []);
      const fetchedProducts = catalog.all_predefined_items || catalog.predefined_products || [];
      setAllProducts(fetchedProducts);

      // If user had existing selections or was already onboarded, load them
      const savedCats = await LocalDB.getSelectedCategories();
      const existingVendorProducts = await api.getVendorProducts();

      if (savedCats && savedCats.length > 0) {
        setSelectedCategories(savedCats);
      } else {
        setSelectedCategories(['vegetables']);
      }

      const idSet = new Set();
      const loadedCustom = [];
      if (existingVendorProducts && existingVendorProducts.length > 0) {
        existingVendorProducts.forEach(p => {
          const pId = p.item_id || p.id;
          if (p.is_active) idSet.add(pId);
          if (p.is_custom) {
            loadedCustom.push({
              id: pId,
              name_en: p.name_en,
              name_ta: p.name_ta || p.name_en,
              category: p.category,
              default_unit: p.default_unit || 'kg',
              is_custom: true
            });
          }
        });
        setSelectedProductIds(idSet);
        if (loadedCustom.length > 0) {
          setCustomProducts(loadedCustom);
        }
      } else {
        setSelectedProductIds(new Set());
      }
    } catch (e) {
      console.warn("Failed to load catalog", e);
    } finally {
      setLoading(false);
    }
  };

  const toggleCategory = (catId) => {
    let updated;
    if (selectedCategories.includes(catId)) {
      if (selectedCategories.length === 1 && !isEditMode) {
        return;
      }
      updated = selectedCategories.filter(c => c !== catId);
      // Remove unselected category's products from selectedProductIds
      const nextSet = new Set(selectedProductIds);
      allProducts.forEach(p => {
        if (isProductInCat(p, catId)) {
          nextSet.delete(p.id);
        }
      });
      setSelectedProductIds(nextSet);
    } else {
      updated = [...selectedCategories, catId];
      // Do not auto-select products - let vendor specifically choose specific products under this category
    }
    setSelectedCategories(updated);
  };

  const toggleProduct = (productId) => {
    const nextSet = new Set(selectedProductIds);
    if (nextSet.has(productId)) {
      nextSet.delete(productId);
    } else {
      nextSet.add(productId);
    }
    setSelectedProductIds(nextSet);
  };

  const selectAllFiltered = () => {
    const nextSet = new Set(selectedProductIds);
    displayedProducts.forEach(p => nextSet.add(p.id));
    setSelectedProductIds(nextSet);
  };

  const deselectAllFiltered = () => {
    const nextSet = new Set(selectedProductIds);
    displayedProducts.forEach(p => nextSet.delete(p.id));
    setSelectedProductIds(nextSet);
  };

  const handleAddCustomProduct = () => {
    if (!customName.trim()) {
      Alert.alert(
        language === 'ta' ? 'பிழை' : 'Missing Information',
        language === 'ta' ? 'பொருளின் பெயரை உள்ளிடவும்' : 'Please enter the product name.'
      );
      return;
    }

    const customId = `custom_${Date.now()}`;
    const targetCat = customCategory || selectedCategories[0] || 'vegetables';
    const newProd = {
      id: customId,
      name_en: customName.trim(),
      name_ta: customName.trim(),
      category: targetCat,
      default_unit: customUnit || 'kg',
      is_custom: true
    };

    setCustomProducts(prev => [...prev, newProd]);
    if (!selectedCategories.includes(targetCat)) {
      setSelectedCategories(prev => [...prev, targetCat]);
    }
    setSelectedProductIds(prev => new Set([...prev, customId]));
    setModalVisible(false);
    setCustomName('');
  };

  const handleSave = async () => {
    const selectedDisplayed = displayedProducts.filter(p => selectedProductIds.has(p.id));
    if (selectedProductIds.size === 0 && selectedDisplayed.length === 0) {
      Alert.alert(
        language === 'ta' ? 'பொருட்களை தேர்வு செய்யவும்' : 'Select at least one product',
        language === 'ta' ? 'விற்பனை செய்ய குறைந்தபட்சம் 1 பொருளை தேர்வு செய்யவும்' : 'Please select at least 1 product to sell.'
      );
      return;
    }

    setSaving(true);
    try {
      const numericProductIds = Array.from(selectedProductIds).filter(id => typeof id === 'number');
      const customProductsToSave = customProducts.filter(cp => selectedProductIds.has(cp.id)).map(cp => ({
        name_en: cp.name_en,
        name_ta: cp.name_ta || cp.name_en,
        category: cp.category,
        default_unit: cp.default_unit || 'kg'
      }));

      const payload = {
        selected_categories: selectedCategories,
        product_ids: numericProductIds,
        custom_products: customProductsToSave
      };

      await api.submitOnboarding(payload);
      await LocalDB.setOnboardingCompleted(true);
      if (onComplete) {
        onComplete();
      }
    } catch (e) {
      console.warn("Save onboarding error", e);
      if (onComplete) onComplete();
    } finally {
      setSaving(false);
    }
  };

  // Filter default products by selected categories
  const filteredDefaultProducts = allProducts.filter(p => {
    return selectedCategories.some(catId => isProductInCat(p, catId));
  });

  // Filter custom products by selected categories
  const filteredCustomProducts = customProducts.filter(cp => {
    return selectedCategories.some(catId => isProductInCat(cp, catId));
  });

  // Combined list shown under Choose Your Products
  const displayedProducts = [
    ...filteredDefaultProducts,
    ...filteredCustomProducts
  ];

  const selectedCountInView = displayedProducts.filter(p => selectedProductIds.has(p.id)).length;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={THEME.colors.primary} />
        <Text style={styles.loadingText}>{t('loading')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Header
        title={language === 'ta' ? 'பொருட்கள் மேலாண்மை (Manage My Products)' : 'Manage My Products'}
        showBack={isEditMode}
        onBack={() => onComplete ? onComplete() : (onNavigate ? onNavigate('home') : null)}
      />
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* HEADER / INTRO */}
        <View style={styles.headerBox}>
          <MaterialCommunityIcons name="store-cog" size={38} color={THEME.colors.primary} />
          <Text style={styles.headerTitle}>
            {language === 'ta' ? 'பொருட்கள் மேலாண்மை (Manage My Products)' : 'Manage My Products'}
          </Text>
          <Text style={styles.headerSubtitle}>
            {language === 'ta'
              ? 'உங்கள் கடையில் விற்கும் வகைகளையும் குறிப்பிட்ட பொருட்களையும் தேர்வு செய்யவும்'
              : 'Choose the categories and specific products you sell in your shop'}
          </Text>
        </View>

        {/* STEP 1: CATEGORY MULTI-SELECTION GRID */}
        <View style={styles.categoryGrid}>
          {categories.map((cat) => {
            const isSelected = selectedCategories.includes(cat.id);
            const catLabel = t('categories')?.[cat.id] || (language === 'ta' ? cat.name_ta : cat.name_en);

            return (
              <TouchableOpacity
                key={cat.id}
                onPress={() => toggleCategory(cat.id)}
                activeOpacity={0.75}
                style={[
                  styles.categoryCard,
                  isSelected && styles.categoryCardSelected
                ]}
              >
                <View style={[styles.iconCircle, isSelected && styles.iconCircleSelected]}>
                  <MaterialCommunityIcons
                    name={cat.icon || 'tag'}
                    size={26}
                    color={isSelected ? '#FFFFFF' : THEME.colors.primary}
                  />
                </View>
                <Text
                  style={[styles.categoryName, isSelected && styles.categoryNameSelected]}
                  numberOfLines={2}
                >
                  {catLabel}
                </Text>
                {isSelected && (
                  <View style={styles.checkBadge}>
                    <MaterialCommunityIcons name="check" size={14} color="#FFFFFF" />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* STEP 2: PREDEFINED & CUSTOM PRODUCTS LIST */}
        <View style={styles.productsSection}>
          <View style={styles.sectionHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>
                {t('selectProductsTitle')} ({selectedCountInView} {language === 'ta' ? 'பொருட்கள் தேர்வு' : 'selected'})
              </Text>
              <Text style={styles.sectionSubtitle}>{t('selectProductsSubtitle')}</Text>
            </View>
          </View>

          {/* SELECT ALL / DESELECT ALL BUTTONS */}
          <View style={styles.bulkActionRow}>
            <TouchableOpacity onPress={selectAllFiltered} style={styles.bulkBtn}>
              <MaterialCommunityIcons name="checkbox-multiple-marked" size={18} color={THEME.colors.primary} />
              <Text style={styles.bulkBtnText}>{t('selectAll')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={deselectAllFiltered} style={styles.bulkBtn}>
              <MaterialCommunityIcons name="checkbox-multiple-blank-outline" size={18} color="#6B7280" />
              <Text style={[styles.bulkBtnText, { color: '#6B7280' }]}>{t('deselectAll')}</Text>
            </TouchableOpacity>
          </View>

          {/* PRODUCTS CHIPS GRID */}
          <View style={styles.productsGrid}>
            {displayedProducts.map((prod) => {
              const isChecked = selectedProductIds.has(prod.id);
              const prodName = language === 'ta' ? (prod.name_ta || prod.name_en) : (prod.name_en || prod.name_ta);
              const isCustom = prod.is_custom;

              return (
                <TouchableOpacity
                  key={String(prod.id)}
                  onPress={() => toggleProduct(prod.id)}
                  activeOpacity={0.75}
                  style={[
                    styles.productChip,
                    isChecked && styles.productChipChecked,
                    isCustom && styles.customProductChip
                  ]}
                >
                  <MaterialCommunityIcons
                    name={isChecked ? "checkbox-marked-circle" : "checkbox-blank-circle-outline"}
                    size={22}
                    color={isChecked ? (isCustom ? "#E65100" : THEME.colors.primary) : "#9CA3AF"}
                  />
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <Text style={[styles.productChipText, isChecked && styles.productChipTextChecked]}>
                      {prodName}
                    </Text>
                    {isCustom && (
                      <View style={styles.customBadge}>
                        <Text style={styles.customBadgeText}>Custom</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.unitPill}>({prod.default_unit || 'kg'})</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* + ADD CUSTOM PRODUCT BUTTON */}
          <TouchableOpacity
            onPress={() => setModalVisible(true)}
            activeOpacity={0.8}
            style={styles.addCustomBtn}
          >
            <MaterialCommunityIcons name="plus-circle" size={26} color={THEME.colors.accent} />
            <Text style={styles.addCustomBtnText}>{t('addCustomProduct')}</Text>
          </TouchableOpacity>
        </View>

        {/* BOTTOM SAVE BUTTON */}
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
          style={styles.saveBtn}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <MaterialCommunityIcons name="check-bold" size={24} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.saveBtnText}>
                {isEditMode ? t('save') : t('saveAndStartSelling')}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* MODAL: ADD CUSTOM PRODUCT */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <MaterialCommunityIcons name="cart-plus" size={26} color={THEME.colors.primary} />
              <Text style={styles.modalTitle}>{t('addCustomProduct')}</Text>
            </View>

            {/* PRODUCT NAME INPUT */}
            <Text style={styles.inputLabel}>{t('customProductName')} *</Text>
            <TextInput
              style={styles.textInput}
              placeholder={language === 'ta' ? 'எ.கா: பன்னீர் சோடா, சுண்டல்' : 'e.g. Paneer Soda, Sundal'}
              value={customName}
              onChangeText={setCustomName}
              autoFocus={true}
            />

            {/* CATEGORY PICKER (CHIPS) */}
            <Text style={styles.inputLabel}>{t('customProductCategory')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
              {categories.map((c) => {
                const isSelected = customCategory === c.id;
                return (
                  <TouchableOpacity
                    key={c.id}
                    onPress={() => setCustomCategory(c.id)}
                    style={[styles.modalChip, isSelected && styles.modalChipSelected]}
                  >
                    <Text style={[styles.modalChipText, isSelected && styles.modalChipTextSelected]}>
                      {t('categories')?.[c.id] || (language === 'ta' ? c.name_ta : c.name_en)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* MEASUREMENT UNIT PICKER (CHIPS) */}
            <Text style={styles.inputLabel}>{t('customProductUnit')}</Text>
            <View style={styles.unitChipsWrap}>
              {unitOptions.map((u) => {
                const isSelected = customUnit === u.key;
                return (
                  <TouchableOpacity
                    key={u.key}
                    onPress={() => setCustomUnit(u.key)}
                    style={[styles.unitChip, isSelected && styles.unitChipSelected]}
                  >
                    <Text style={[styles.unitChipText, isSelected && styles.unitChipTextSelected]}>
                      {u.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* MODAL ACTIONS */}
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={[styles.modalBtn, styles.modalCancelBtn]}
              >
                <Text style={styles.modalCancelBtnText}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleAddCustomProduct}
                style={[styles.modalBtn, styles.modalAddBtn]}
              >
                <Text style={styles.modalAddBtnText}>{t('save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: THEME.colors.bg
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: THEME.colors.bg
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: THEME.colors.textMuted
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40
  },
  headerBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: THEME.borderRadius.lg,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    marginBottom: 18,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: THEME.colors.textDark,
    textAlign: 'center',
    marginTop: 8
  },
  headerSubtitle: {
    fontSize: 14,
    color: THEME.colors.textMuted,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20
  },
  categoryCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: THEME.borderRadius.md,
    padding: 14,
    marginBottom: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    elevation: 2,
    minHeight: 110,
    justifyContent: 'center',
    position: 'relative'
  },
  categoryCardSelected: {
    borderColor: THEME.colors.primary,
    backgroundColor: THEME.colors.primaryBg
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8
  },
  iconCircleSelected: {
    backgroundColor: THEME.colors.primary
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.textDark,
    textAlign: 'center'
  },
  categoryNameSelected: {
    color: THEME.colors.primary,
    fontWeight: '900'
  },
  checkBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: THEME.colors.primary,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center'
  },
  productsSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: THEME.borderRadius.lg,
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    marginBottom: 20
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: THEME.colors.textDark
  },
  sectionSubtitle: {
    fontSize: 13,
    color: THEME.colors.textMuted,
    marginTop: 2
  },
  bulkActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 12,
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingBottom: 10
  },
  bulkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6
  },
  bulkBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.primary
  },
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  productChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    gap: 8,
    flexShrink: 1
  },
  productChipChecked: {
    backgroundColor: THEME.colors.primaryBg,
    borderColor: THEME.colors.primary
  },
  productChipText: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.colors.textDark
  },
  productChipTextChecked: {
    color: THEME.colors.primary,
    fontWeight: '800'
  },
  unitPill: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600'
  },
  customListContainer: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB'
  },
  customListTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.textDark,
    marginBottom: 8
  },
  addCustomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    paddingVertical: 14,
    backgroundColor: THEME.colors.accentLight,
    borderRadius: THEME.borderRadius.md,
    borderWidth: 2,
    borderColor: THEME.colors.accent,
    borderStyle: 'dashed',
    gap: 8
  },
  addCustomBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.colors.accent
  },
  saveBtn: {
    backgroundColor: THEME.colors.primary,
    borderRadius: THEME.borderRadius.md,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    elevation: 4,
    shadowColor: THEME.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5
  },
  saveBtnText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: THEME.borderRadius.lg,
    padding: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: THEME.colors.textDark
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.textDark,
    marginTop: 12,
    marginBottom: 6
  },
  textInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: THEME.borderRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: THEME.colors.textDark
  },
  chipsScroll: {
    flexDirection: 'row',
    marginBottom: 6
  },
  modalChip: {
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB'
  },
  modalChipSelected: {
    backgroundColor: THEME.colors.primary,
    borderColor: THEME.colors.primary
  },
  modalChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textDark
  },
  modalChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '800'
  },
  unitChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20
  },
  unitChip: {
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#E5E7EB'
  },
  unitChipSelected: {
    backgroundColor: THEME.colors.primary,
    borderColor: THEME.colors.primary
  },
  unitChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textDark
  },
  unitChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '800'
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 10
  },
  modalBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: THEME.borderRadius.md,
    minWidth: 100,
    alignItems: 'center'
  },
  modalCancelBtn: {
    backgroundColor: '#F3F4F6'
  },
  modalCancelBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.colors.textMuted
  },
  modalAddBtn: {
    backgroundColor: THEME.colors.primary
  },
  modalAddBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF'
  },
  customProductChip: {
    borderColor: '#FFB74D',
    backgroundColor: '#FFF8E1'
  },
  customBadge: {
    backgroundColor: '#FF9800',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6
  },
  customBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800'
  }
});
