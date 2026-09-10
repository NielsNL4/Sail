import { StyleSheet, Text, View } from 'react-native';

export function InstrumentCell({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <Text adjustsFontSizeToFit numberOfLines={1} style={styles.value}>
        {value} <Text style={styles.unit}>{unit}</Text>
      </Text>
    </View>
  );
}

export const instrumentStyles = StyleSheet.create({
  panel: {
    borderWidth: 1,
    borderColor: 'rgba(125, 211, 252, 0.6)',
    borderRadius: 16,
    backgroundColor: 'rgba(8, 47, 73, 0.94)',
    boxShadow: '0 5px 16px rgba(8, 47, 73, 0.3)',
    elevation: 8,
  },
});

const styles = StyleSheet.create({
  label: {
    color: '#7dd3fc',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  value: {
    color: '#f8fafc',
    fontSize: 32,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  unit: { color: '#bae6fd', fontSize: 13, fontWeight: '700' },
});
