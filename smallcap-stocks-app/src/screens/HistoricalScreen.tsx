import { useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { CompositeScreenProps } from '@react-navigation/native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Pressable } from 'react-native';
import { SMALL_CAP_UNIVERSE } from '../constants/smallCapUniverse';
import { colors, spacing } from '../constants/theme';
import { MainTabParamList, RootStackParamList } from '../navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Historical'>,
  NativeStackScreenProps<RootStackParamList>
>;

export function HistoricalScreen({ navigation }: Props) {
  const [search, setSearch] = useState('');

  const filtered = SMALL_CAP_UNIVERSE.filter(
    (stock) =>
      stock.symbol.toLowerCase().includes(search.toLowerCase()) ||
      stock.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Historical Data</Text>
        <Text style={styles.subtitle}>Select a small cap to view price history and charts</Text>
      </View>

      <TextInput
        style={styles.searchInput}
        placeholder="Search symbol or company..."
        placeholderTextColor={colors.textMuted}
        value={search}
        onChangeText={setSearch}
        autoCapitalize="characters"
        autoCorrect={false}
      />

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.symbol}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() =>
              navigation.navigate('StockDetail', {
                symbol: item.symbol,
                name: item.name,
              })
            }
          >
            <View>
              <Text style={styles.symbol}>{item.symbol}</Text>
              <Text style={styles.name}>{item.name}</Text>
            </View>
            <View style={styles.sectorBadge}>
              <Text style={styles.sectorText}>{item.sector}</Text>
            </View>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    marginTop: spacing.xs,
  },
  searchInput: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    color: colors.text,
    fontSize: 15,
  },
  list: {
    padding: spacing.md,
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  symbol: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  name: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  sectorBadge: {
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  sectorText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '600',
  },
});
