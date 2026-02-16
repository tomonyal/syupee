import React, { useRef, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS } from '../../constants';
import { CATEGORIES } from '../../constants';
import { ExpenseCategory } from '../../types';

interface CategoryFilterProps {
  selected: ExpenseCategory | null;
  onSelect: (category: ExpenseCategory | null) => void;
}

export default function CategoryFilter({ selected, onSelect }: CategoryFilterProps) {
  const scrollRef = useRef<ScrollView>(null);
  const containerRef = useRef<View>(null);
  const itemRefs = useRef<Record<string, View | null>>({});
  const scrollViewWidth = useRef(0);

  const scrollToSelected = useCallback((key: string) => {
    const itemView = itemRefs.current[key];
    const container = containerRef.current;
    if (!itemView || !container || !scrollRef.current) return;

    try {
      itemView.measureLayout(
        container as any,
        (x, _y, width, _height) => {
          const targetX = Math.max(0, x - scrollViewWidth.current / 2 + width / 2);
          scrollRef.current?.scrollTo({ x: targetX, animated: true });
        },
        () => {}
      );
    } catch {}
  }, []);

  const handleSelect = useCallback((category: ExpenseCategory | null) => {
    onSelect(category);
    // 次フレームでスクロール（コンポーネントは再マウントされないので即座に動く）
    const key = category ?? '__all__';
    requestAnimationFrame(() => scrollToSelected(key));
  }, [onSelect, scrollToSelected]);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ flexGrow: 0 }}
      onLayout={(e) => {
        scrollViewWidth.current = e.nativeEvent.layout.width;
      }}
    >
      <View ref={containerRef} style={styles.container}>
        <TouchableOpacity
          ref={(r) => { itemRefs.current['__all__'] = r as any; }}
          style={[styles.chip, !selected && styles.chipActive]}
          onPress={() => handleSelect(null)}
        >
          <Text style={[styles.chipText, !selected && styles.chipTextActive]}>
            すべて
          </Text>
        </TouchableOpacity>

        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.key}
            ref={(r) => { itemRefs.current[cat.key] = r as any; }}
            style={[
              styles.chip,
              selected === cat.key && { backgroundColor: cat.color },
            ]}
            onPress={() => handleSelect(selected === cat.key ? null : cat.key)}
          >
            <Text
              style={[
                styles.chipText,
                selected === cat.key && styles.chipTextActive,
              ]}
            >
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  chip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  chipTextActive: {
    color: COLORS.textOnPrimary,
  },
});
