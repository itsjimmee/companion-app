import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Calendar, DateData } from 'react-native-calendars';
import { colors, spacing } from '../constants/theme';
import { formatDateEt, parseIsoDate } from '../utils/dates';

interface DatePickerFieldProps {
  label: string;
  value: string;
  onChange: (isoDate: string) => void;
  minimumDate?: string;
  maximumDate?: string;
}

/** iOS date pickers crash if value is outside [minimumDate, maximumDate]. */
function clampDate(date: Date, minimumDate?: string, maximumDate?: string): Date {
  let ms = date.getTime();
  if (minimumDate) ms = Math.max(ms, parseIsoDate(minimumDate).getTime());
  if (maximumDate) ms = Math.min(ms, parseIsoDate(maximumDate).getTime());
  return new Date(ms);
}

const calendarTheme = {
  backgroundColor: colors.surface,
  calendarBackground: colors.surface,
  textSectionTitleColor: colors.textMuted,
  selectedDayBackgroundColor: colors.primary,
  selectedDayTextColor: '#ffffff',
  todayTextColor: colors.primary,
  dayTextColor: colors.text,
  textDisabledColor: '#3d4a66',
  monthTextColor: colors.text,
  arrowColor: colors.primary,
  textDayFontWeight: '600' as const,
  textMonthFontWeight: '700' as const,
  textDayHeaderFontWeight: '600' as const,
};

export function DatePickerField({ label, value, onChange, minimumDate, maximumDate }: DatePickerFieldProps) {
  const [open, setOpen] = useState(false);
  const safeValue = useMemo(
    () => formatDateEt(clampDate(parseIsoDate(value), minimumDate, maximumDate)),
    [value, minimumDate, maximumDate]
  );

  const markedDates = useMemo(
    () => ({
      [safeValue]: { selected: true, selectedColor: colors.primary },
    }),
    [safeValue]
  );

  const onDayPress = (day: DateData) => {
    const picked = clampDate(parseIsoDate(day.dateString), minimumDate, maximumDate);
    onChange(formatDateEt(picked));
    setOpen(false);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.field} onPress={() => setOpen(true)}>
        <Text style={styles.value}>{safeValue}</Text>
        <Text style={styles.icon}>📅</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Pressable onPress={() => setOpen(false)}>
              <Text style={styles.cancel}>Cancel</Text>
            </Pressable>
            <Text style={styles.sheetTitle}>{label}</Text>
            <View style={styles.headerSpacer} />
          </View>
          <Calendar
            current={safeValue}
            minDate={minimumDate}
            maxDate={maximumDate}
            markedDates={markedDates}
            onDayPress={onDayPress}
            enableSwipeMonths
            theme={calendarTheme}
            style={styles.calendar}
          />
        </View>
      </Modal>
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
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
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
  cancel: { color: colors.textSecondary, fontSize: 16, minWidth: 64 },
  headerSpacer: { minWidth: 64 },
  calendar: {
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
});
