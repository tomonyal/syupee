import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Alert,
  ScrollView,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useIsFocused, useFocusEffect } from '@react-navigation/native';
import { Button, Card, LoadingOverlay } from '../components';
import { useScanStore, useExpenseStore, useAuthStore, useCoinStore, useUsageStore } from '../store';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, CATEGORIES, CATEGORY_MAP, PLAN_MAP, COIN_PER_SCAN } from '../constants';
import { ExpenseCategory, ParsedReceipt } from '../types';
import { useOCRQuota } from '../database/quota';
import { decrementOCRQuotaFirestore } from '../services/firebase';

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const navigation = useNavigation<any>();
  const isFocused = useIsFocused();
  const { user, refresh } = useAuthStore();
  const { addExpense } = useExpenseStore();
  const { balance, ocrQuotaBalance, canScan, useForScan, loadCoinData } = useCoinStore();
  const { ocrUsedThisMonth, loadUsage } = useUsageStore();
  const {
    imageUri,
    parsedReceipt,
    isProcessing,
    step,
    error,
    setImageUri,
    processImage,
    reset,
    setParsedReceipt,
  } = useScanStore();

  // 画面フォーカス時にFirestoreから最新データを取得してから使用回数を読み込み
  useFocusEffect(
    useCallback(() => {
      refresh().then(() => loadUsage());
    }, [])
  );

  // 使用上限チェック（プラン枠＋追加購入枠）
  const planInfo = user ? PLAN_MAP[user.plan] : null;
  const planLimitReached = planInfo ? ocrUsedThisMonth >= planInfo.ocrLimit : false;
  const isOverLimit = planLimitReached && ocrQuotaBalance <= 0;

  // コインチェック＆消費してから読み込み
  const processWithCoinCheck = async () => {
    if (!user) return;

    // プラン上限内ならコイン・枠不要
    if (!isOverLimit) {
      await processImage(user.uid);
      return;
    }

    // 上限超過 → OCR枠をチェック
    if (ocrQuotaBalance > 0) {
      try {
        const success = await useOCRQuota();
        if (success) {
          // Firestoreの枠も消費
          if (user) {
            await decrementOCRQuotaFirestore(user.uid);
          }
          await loadCoinData(); // 枠残高を更新
          await processImage(user.uid);
          return;
        }
      } catch (e: any) {
        Alert.alert('エラー', e.message);
        reset();
        return;
      }
    }

    // OCR枠もない → コインが必要
    if (!canScan()) {
      Alert.alert(
        'コインまたは枠が足りません',
        `レシート読み込みには${COIN_PER_SCAN}コインか、OCR枠が必要です。\n\nコイン残高: ${balance}\nOCR枠: ${ocrQuotaBalance}`,
        [
          { text: 'キャンセル', style: 'cancel', onPress: () => reset() },
          { text: 'ショップへ', onPress: () => { reset(); navigation.navigate('CoinShop'); } },
        ]
      );
      return;
    }

    try {
      await useForScan();
      await processImage(user.uid);
    } catch (e: any) {
      Alert.alert('エラー', e.message);
      reset();
    }
  };

  // 写真撮影
  const takePicture = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (photo?.uri) {
        setImageUri(photo.uri);
        if (user) {
          await processWithCoinCheck();
        }
      }
    } catch (err) {
      Alert.alert('エラー', '写真の撮影に失敗しました');
    }
  };

  // ギャラリーから選択
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      if (user) {
        await processWithCoinCheck();
      }
    }
  };

  // 保存
  const handleSave = async () => {
    if (!parsedReceipt) return;

    try {
      await addExpense({
        amount: parsedReceipt.totalAmount,
        category: parsedReceipt.suggestedCategory,
        storeName: parsedReceipt.storeName,
        date: parsedReceipt.date,
        items: parsedReceipt.items.map((item) => ({
          ...item,
          category: item.category ?? parsedReceipt.suggestedCategory,
        })),
        memo: '',
        receiptImageUri: imageUri || undefined,
      });

      Alert.alert('保存完了', '支出を記録しました！🎉', [
        { text: 'OK', onPress: () => reset() },
      ]);
    } catch (err) {
      Alert.alert('エラー', '保存に失敗しました');
    }
  };

  // カメラ許可がない場合
  if (!permission) {
    return <View style={styles.screen} />;
  }

  if (!permission.granted) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Ionicons name="camera-outline" size={64} color={COLORS.textLight} />
        <Text style={styles.permissionText}>
          レシートを撮影するにはカメラの許可が必要です
        </Text>
        <Button title="次へ" onPress={requestPermission} />
      </View>
    );
  }

  // 上限超え（枠もコインもない場合のみ表示）
  if (isOverLimit) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Ionicons name="alert-circle-outline" size={64} color={COLORS.warning} />
        <Text style={styles.permissionText}>
          今月のOCR利用回数が上限に達しました{'\n'}
          コインまたは追加枠を購入すると利用できます
        </Text>
        <Button
          title="追加枠・コインを購入"
          onPress={() => navigation.navigate('QuotaPurchase')}
          style={{ marginBottom: 12 }}
        />
        <Button
          title="プランをアップグレード"
          onPress={() => navigation.navigate('PlanSelect')}
        />
      </View>
    );
  }

  // 確認・編集画面
  if (step === 'confirm' && parsedReceipt) {
    return (
      <ConfirmScreen
        receipt={parsedReceipt}
        imageUri={imageUri}
        onSave={handleSave}
        onEdit={(updated) => setParsedReceipt(updated)}
        onRetry={reset}
      />
    );
  }

  // カメラ画面
  return (
    <View style={styles.screen}>
      <LoadingOverlay visible={isProcessing} message="レシートを読み取り中..." />

      {isFocused && !imageUri && !isProcessing ? (
        <CameraView ref={cameraRef} style={styles.camera} facing="back" />
      ) : (
        <View style={styles.camera} />
      )}

      {/* ガイドオーバーレイ（カメラの上に絶対位置で配置） */}
      <View style={styles.cameraOverlay} pointerEvents="none">
        <View style={styles.guideFrame}>
          <View style={styles.guideCornerTL} />
          <View style={styles.guideCornerTR} />
          <View style={styles.guideCornerBL} />
          <View style={styles.guideCornerBR} />
        </View>

        <Text style={styles.guideText}>
          レシートを枠に合わせて撮影してね📸
        </Text>
      </View>

      {/* 操作ボタン */}
      <View style={styles.controls}>
        <TouchableOpacity style={styles.galleryButton} onPress={pickImage}>
          <Ionicons name="images" size={28} color={COLORS.text} />
          <Text style={styles.galleryLabel}>ギャラリー</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
          <View style={styles.captureInner} />
        </TouchableOpacity>

        <View style={{ width: 60 }} />
      </View>

      {/* エラー表示 */}
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={reset}>
            <Ionicons name="close" size={20} color={COLORS.textOnPrimary} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// 確認・編集サブコンポーネント
function ConfirmScreen({
  receipt,
  imageUri,
  onSave,
  onEdit,
  onRetry,
}: {
  receipt: ParsedReceipt;
  imageUri: string | null;
  onSave: () => void;
  onEdit: (r: ParsedReceipt) => void;
  onRetry: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [storeName, setStoreName] = useState(receipt.storeName);
  const [totalAmount, setTotalAmount] = useState(String(receipt.totalAmount));
  const [category, setCategory] = useState(receipt.suggestedCategory);
  const [date, setDate] = useState(receipt.date);
  const [items, setItems] = useState(receipt.items);

  const handleUpdate = () => {
    onEdit({
      ...receipt,
      storeName,
      totalAmount: Number(totalAmount) || 0,
      suggestedCategory: category,
      date,
      items,
    });
    setEditing(false);
  };

  const updateItemCategory = (index: number, newCategory: ExpenseCategory) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], category: newCategory };
    setItems(newItems);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.confirmContent}>
      {/* レシート画像プレビュー */}
      {imageUri && (
        <Image source={{ uri: imageUri }} style={styles.receiptPreview} resizeMode="contain" />
      )}

      <Card title="📋 読み取り結果" style={styles.resultCard}>
        {/* 店名 */}
        <FieldRow
          label="店名"
          value={storeName}
          editing={editing}
          onChangeText={setStoreName}
        />

        {/* 日付 */}
        <FieldRow
          label="日付"
          value={date}
          editing={editing}
          onChangeText={setDate}
          placeholder="YYYY-MM-DD"
        />

        {/* 合計金額 */}
        <FieldRow
          label="合計金額"
          value={editing ? totalAmount : `¥${Number(totalAmount).toLocaleString()}`}
          editing={editing}
          onChangeText={setTotalAmount}
          keyboardType="numeric"
        />

        {/* カテゴリ */}
        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>カテゴリ</Text>
          {editing ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.categoryChips}>
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat.key}
                    style={[
                      styles.categoryChip,
                      category === cat.key && { backgroundColor: cat.color },
                    ]}
                    onPress={() => setCategory(cat.key)}
                  >
                    <Text
                      style={[
                        styles.categoryChipText,
                        category === cat.key && { color: '#FFF' },
                      ]}
                    >
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          ) : (
            <View style={[styles.categoryTag, { backgroundColor: CATEGORY_MAP[category]?.color + '20' }]}>
              <Text style={[styles.categoryTagText, { color: CATEGORY_MAP[category]?.color }]}>
                {CATEGORY_MAP[category]?.label || 'その他'}
              </Text>
            </View>
          )}
        </View>

        {/* 明細 */}
        {items.length > 0 && (
          <View style={styles.itemsSection}>
            <Text style={styles.itemsSectionTitle}>明細</Text>
            {items.map((item, idx) => (
              <View key={idx} style={styles.itemRowContainer}>
                <View style={styles.itemRow}>
                  <View style={styles.itemNameAndCategory}>
                    <Text style={styles.itemName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    {editing ? (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.itemCategoryScroll}>
                        <View style={styles.itemCategoryChips}>
                          {CATEGORIES.map((cat) => (
                            <TouchableOpacity
                              key={cat.key}
                              style={[
                                styles.itemCategoryChip,
                                item.category === cat.key && { backgroundColor: cat.color },
                              ]}
                              onPress={() => updateItemCategory(idx, cat.key)}
                            >
                              <Text
                                style={[
                                  styles.itemCategoryChipText,
                                  item.category === cat.key && { color: '#FFF' },
                                ]}
                              >
                                {cat.label}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </ScrollView>
                    ) : (
                      <View style={[styles.itemCategoryTag, { backgroundColor: CATEGORY_MAP[item.category || 'other']?.color + '20' }]}>
                        <Text style={[styles.itemCategoryTagText, { color: CATEGORY_MAP[item.category || 'other']?.color }]}>
                          {CATEGORY_MAP[item.category || 'other']?.label || 'その他'}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.itemPrice}>
                    ¥{item.price.toLocaleString()} ×{item.quantity}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </Card>

      {/* アクションボタン */}
      <View style={styles.confirmActions}>
        {editing ? (
          <Button title="変更を適用" onPress={handleUpdate} fullWidth />
        ) : (
          <>
            <Button title="この内容で保存 ✨" onPress={onSave} fullWidth size="large" />
            <View style={styles.subActions}>
              <Button title="修正する" onPress={() => setEditing(true)} variant="outline" />
              <Button title="撮り直す" onPress={onRetry} variant="ghost" />
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
}

function FieldRow({
  label,
  value,
  editing,
  onChangeText,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  editing: boolean;
  onChangeText?: (text: string) => void;
  placeholder?: string;
  keyboardType?: 'numeric' | 'default';
}) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {editing ? (
        <TextInput
          style={styles.fieldInput}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          keyboardType={keyboardType}
        />
      ) : (
        <Text style={styles.fieldValue}>{value}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
    gap: SPACING.md,
  },
  permissionText: {
    fontSize: FONT_SIZE.lg,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginVertical: SPACING.md,
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  guideFrame: {
    width: '80%',
    height: '60%',
    position: 'relative',
  },
  guideCornerTL: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 30,
    height: 30,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: COLORS.accent,
    borderTopLeftRadius: 8,
  },
  guideCornerTR: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 30,
    height: 30,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderColor: COLORS.accent,
    borderTopRightRadius: 8,
  },
  guideCornerBL: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 30,
    height: 30,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderColor: COLORS.accent,
    borderBottomLeftRadius: 8,
  },
  guideCornerBR: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 30,
    height: 30,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderColor: COLORS.accent,
    borderBottomRightRadius: 8,
  },
  guideText: {
    position: 'absolute',
    bottom: '15%',
    color: '#FFF',
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: SPACING.lg,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  galleryButton: {
    alignItems: 'center',
    width: 60,
  },
  galleryLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: COLORS.primaryLight,
  },
  captureInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    borderWidth: 2,
    borderColor: '#FFF',
  },
  errorBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.error,
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  errorText: {
    flex: 1,
    color: COLORS.textOnPrimary,
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
  },
  // 確認画面
  confirmContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  receiptPreview: {
    width: '100%',
    height: 200,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.md,
    backgroundColor: COLORS.border,
  },
  resultCard: {
    marginBottom: SPACING.md,
  },
  fieldRow: {
    marginBottom: SPACING.md,
  },
  fieldLabel: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    fontWeight: '600',
    marginBottom: 4,
  },
  fieldValue: {
    fontSize: FONT_SIZE.lg,
    color: COLORS.text,
    fontWeight: '600',
  },
  fieldInput: {
    fontSize: FONT_SIZE.lg,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  categoryChips: {
    flexDirection: 'row',
    gap: SPACING.xs,
    paddingVertical: SPACING.xs,
  },
  categoryChip: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  categoryChipText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  categoryTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
  },
  categoryTagText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
  },
  itemsSection: {
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  itemsSectionTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  itemRowContainer: {
    marginBottom: SPACING.sm,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 4,
  },
  itemNameAndCategory: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  itemName: {
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    fontWeight: '600',
  },
  itemCategoryScroll: {
    maxHeight: 40,
  },
  itemCategoryChips: {
    flexDirection: 'row',
    gap: SPACING.xs,
    paddingVertical: 2,
  },
  itemCategoryChip: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  itemCategoryChipText: {
    fontSize: 10,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  itemCategoryTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
  },
  itemCategoryTagText: {
    fontSize: 10,
    fontWeight: '600',
  },
  confirmActions: {
    gap: SPACING.md,
  },
  subActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.md,
  },
});
