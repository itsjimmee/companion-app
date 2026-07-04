import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { colors, spacing } from '../constants/theme';
import { formatDateEt, parseIsoDate } from '../utils/dates';

interface DatePickerFieldProps {
  label: string;
  value: string;
  onChange: (isoDate: string) => void;
  minimumDate?: string;
  maximumDate?: string;
}

export function DatePickerField({ label, value, onChange, minimumDate, maximumDate }: DatePickerFieldProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(parseIsoDate(value));

  const openPicker = () => {
    setDraft(parseIsoDate(value));
    setOpen(true);
  };

  const commit = (date: Date) => {
    onChange(formatDateEt(date));
    setOpen(false);
  };

  const onPickerChange = (_event: DateTimePickerEvent, selected?: Date) => {
    if (!selected) {
      if (Platform.OS === 'android') setOpen(false);
      return;
    }
    setDraft(selected);
    if (Platform.OS === 'android') commit(selected);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.field} onPress={openPicker}>
        <Text style={styles.value}>{value}</Text>
        <Text style={styles.icon}>📅</Text>
      </Pressable>

      {Platform.OS === 'android' && open ? (
        <DateTimePicker
          value={draft}
          mode="date"
          display="calendar"
          onChange={onPickerChange}
          minimumDate={minimumDate ? parseIsoDate(minimumDate) : undefined}
          maximumDate={maximumDate ? parseIsoDate(maximumDate) : undefined}
        />
      ) : null}

      {Platform.OS !== 'android' ? (
        <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Pressable onPress={() => setOpen(false)}>
                <Text style={styles.cancel}>Cancel</Text>
              </Pressable>
              <Text style={styles.sheetTitle}>{label}</Text>
              <Pressable onPress={() => commit(draft)}>
                <Text style={styles.done}>Done</Text>
              </Pressable>
            </View>
            <DateTimePicker
              value={draft}
              mode="date"
              display="inline"
              onChange={onPickerChange}
              themeVariant="dark"
              minimumDate={minimumDate ? parseIsoDate(minimumDate) : undefined}
              maximumDate={maximumDate ? parseIsoDate(maximumDate) : undefined}
              style={styles.picker}
            />
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, minWidth: 120 },
  label: {
    color: colors.textMuted,
    fontSize: 11,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
  },
  value: { color: colors.text, fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] },
  icon: { fontSize: 16 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: spacing.lg,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sheetTitle: { color: colors.text, fontWeight: '700', fontSize: 16 },
  cancel: { color: colors.textSecondary, fontSize: 16 },
  done: { color: colors.primary, fontWeight: '700', fontSize: 16 },
  picker: { height: 320 },
});
