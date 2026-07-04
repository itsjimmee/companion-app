import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../constants/theme';
import { formatDateEt, parseIsoDate } from '../utils/dates';

interface MonthCalendarProps {
  value: string;
  minimumDate?: string;
  maximumDate?: string;
  onSelect: (isoDate: string) => void;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function monthStart(dateStr: string): string {
  return `${dateStr.slice(0, 7)}-01`;
}

function shiftMonth(dateStr: string, delta: number): string {
  const d = parseIsoDate(monthStart(dateStr));
  d.setMonth(d.getMonth() + delta);
  return formatDateEt(d);
}

function isDisabled(day: string, minimumDate?: string, maximumDate?: string): boolean {
  if (minimumDate && day < minimumDate) return true;
  if (maximumDate && day > maximumDate) return true;
  return false;
}

function buildMonthGrid(visibleMonth: string): { day: string; inMonth: boolean }[] {
  const anchor = parseIsoDate(monthStart(visibleMonth));
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: { day: string; inMonth: boolean }[] = [];

  for (let i = 0; i < firstDow; i++) {
    const d = new Date(year, month, 1 - (firstDow - i));
    cells.push({ day: formatDateEt(d), inMonth: false });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ day: formatDateEt(new Date(year, month, day)), inMonth: true });
  }

  while (cells.length % 7 !== 0) {
    const last = parseIsoDate(cells[cells.length - 1].day);
    last.setDate(last.getDate() + 1);
    cells.push({ day: formatDateEt(last), inMonth: false });
  }

  return cells;
}

function monthTitle(visibleMonth: string): string {
  const d = parseIsoDate(monthStart(visibleMonth));
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(d);
}

export function MonthCalendar({ value, minimumDate, maximumDate, onSelect }: MonthCalendarProps) {
  const today = useMemo(() => formatDateEt(new Date()), []);
  const [visibleMonth, setVisibleMonth] = useState(() => monthStart(value));
  const cells = useMemo(() => buildMonthGrid(visibleMonth), [visibleMonth]);

  const canGoPrev = !minimumDate || shiftMonth(visibleMonth, -1).slice(0, 7) >= minimumDate.slice(0, 7);
  const canGoNext = !maximumDate || shiftMonth(visibleMonth, 1).slice(0, 7) <= maximumDate.slice(0, 7);

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Pressable
          style={[styles.navBtn, !canGoPrev && styles.navBtnDisabled]}
          disabled={!canGoPrev}
          onPress={() => setVisibleMonth((m) => shiftMonth(m, -1))}
        >
          <Text style={styles.navText}>‹</Text>
        </Pressable>
        <Text style={styles.title}>{monthTitle(visibleMonth)}</Text>
        <Pressable
          style={[styles.navBtn, !canGoNext && styles.navBtnDisabled]}
          disabled={!canGoNext}
          onPress={() => setVisibleMonth((m) => shiftMonth(m, 1))}
        >
          <Text style={styles.navText}>›</Text>
        </Pressable>
      </View>

      <View style={styles.weekRow}>
        {WEEKDAYS.map((label) => (
          <Text key={label} style={styles.weekLabel}>
            {label}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map(({ day, inMonth }) => {
          const selected = day === value;
          const disabled = !inMonth || isDisabled(day, minimumDate, maximumDate);
          const isToday = day === today;

          return (
            <Pressable
              key={day}
              style={[
                styles.dayCell,
                selected && styles.daySelected,
                isToday && !selected && styles.dayToday,
                disabled && styles.dayDisabled,
              ]}
              disabled={disabled}
              onPress={() => onSelect(day)}
            >
              <Text
                style={[
                  styles.dayText,
                  !inMonth && styles.dayTextMuted,
                  selected && styles.dayTextSelected,
                  disabled && styles.dayTextDisabled,
                  isToday && !selected && styles.dayTextToday,
                ]}
              >
                {Number(day.slice(8, 10))}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.sm, paddingBottom: spacing.sm },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  title: { color: colors.text, fontSize: 17, fontWeight: '700' },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
  },
  navBtnDisabled: { opacity: 0.35 },
  navText: { color: colors.text, fontSize: 24, lineHeight: 28, fontWeight: '300' },
  weekRow: { flexDirection: 'row', marginBottom: 4 },
  weekLabel: {
    flex: 1,
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },
  daySelected: { backgroundColor: colors.primary },
  dayToday: { borderWidth: 1, borderColor: colors.primary },
  dayDisabled: { opacity: 0.35 },
  dayText: { color: colors.text, fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
  dayTextMuted: { color: colors.textMuted },
  dayTextSelected: { color: '#ffffff' },
  dayTextDisabled: { color: colors.textMuted },
  dayTextToday: { color: colors.primary },
});
