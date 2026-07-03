import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, spacing } from '../constants/theme';
import { ScannerFilter } from '../types/stock';

interface ScannerFiltersProps {
  filter: ScannerFilter;
  onChange: (filter: ScannerFilter) => void;
}

function FilterInput({
  label,
  value,
  onChangeText,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
}) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        keyboardType="numeric"
        placeholderTextColor={colors.textMuted}
      />
    </View>
  );
}

export function ScannerFilters({ filter, onChange }: ScannerFiltersProps) {
  const update = (partial: Partial<ScannerFilter>) => onChange({ ...filter, ...partial });

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      <FilterInput
        label="Min Gap %"
        value={String(filter.minGapPercent)}
        onChangeText={(v) => update({ minGapPercent: Number(v) || 0 })}
      />
      <FilterInput
        label="Min Chg %"
        value={String(filter.minChangePercent)}
        onChangeText={(v) => update({ minChangePercent: Number(v) || 0 })}
      />
      <FilterInput
        label="Min Vol"
        value={String(Math.round(filter.minVolume / 1000)) + 'K'}
        onChangeText={(v) => update({ minVolume: (Number(v.replace(/\D/g, '')) || 0) * 1000 })}
      />
      <FilterInput
        label="Min $"
        value={String(filter.minPrice)}
        onChangeText={(v) => update({ minPrice: Number(v) || 0 })}
      />
      <FilterInput
        label="Max $"
        value={String(filter.maxPrice)}
        onChangeText={(v) => update({ maxPrice: Number(v) || 0 })}
      />
      <View style={styles.sortGroup}>
        <Text style={styles.label}>Sort</Text>
        <View style={styles.sortButtons}>
          {(['gapPercent', 'changePercent', 'volume'] as const).map((key) => (
            <Text
              key={key}
              style={[styles.sortChip, filter.sortBy === key && styles.sortChipActive]}
              onPress={() => update({ sortBy: key })}
            >
              {key === 'gapPercent' ? 'Gap' : key === 'changePercent' ? '%' : 'Vol'}
            </Text>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  inputGroup: { minWidth: 72 },
  label: {
    color: colors.textMuted,
    fontSize: 11,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    fontSize: 14,
    minWidth: 72,
  },
  sortGroup: { justifyContent: 'flex-end' },
  sortButtons: { flexDirection: 'row', gap: 6 },
  sortChip: {
    backgroundColor: colors.surfaceElevated,
    color: colors.textSecondary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    overflow: 'hidden',
    fontSize: 13,
    fontWeight: '600',
    borderWidth: 1,
    borderColor: colors.border,
  },
  sortChipActive: {
    backgroundColor: colors.primary,
    color: colors.text,
    borderColor: colors.primary,
  },
});
