import { StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import Colors from '@/constants/colors';
import type { ListingAttributeDefinition, ListingAttributeValue } from '@/lib/use-listing-taxonomy';

interface ListingAttributeFieldsProps {
  definitions: ListingAttributeDefinition[];
  values: Record<string, ListingAttributeValue>;
  onChange: (name: string, value: ListingAttributeValue) => void;
}

export default function ListingAttributeFields({
  definitions,
  values,
  onChange,
}: ListingAttributeFieldsProps) {
  if (definitions.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.title}>Listing Fields</Text>
      <Text style={styles.helper}>Additional details configured for this subcategory.</Text>
      {definitions.map((attribute) => {
        const value = values[attribute.name];
        const normalizedType = attribute.fieldType.trim().toLowerCase();
        const isBoolean = normalizedType === 'boolean';
        const isNumeric = normalizedType === 'number' || normalizedType === 'price';

        return (
          <View key={attribute.name} style={styles.field}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>
                {attribute.name}
                {attribute.required ? ' *' : ''}
              </Text>
              {attribute.unit ? <Text style={styles.unit}>{attribute.unit}</Text> : null}
            </View>
            {isBoolean ? (
              <View style={styles.booleanRow}>
                <Text style={styles.booleanText}>{value === true ? 'Yes' : 'No'}</Text>
                <Switch
                  value={value === true}
                  onValueChange={(nextValue) => onChange(attribute.name, nextValue)}
                  trackColor={{ false: Colors.border, true: Colors.primary }}
                  thumbColor="#FFFFFF"
                />
              </View>
            ) : (
              <TextInput
                style={styles.input}
                value={value === undefined || value === null ? '' : String(value)}
                onChangeText={(nextValue) => onChange(attribute.name, nextValue)}
                placeholder={attribute.fieldType}
                placeholderTextColor={Colors.textTertiary}
                keyboardType={isNumeric ? 'numeric' : 'default'}
              />
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 10,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  title: {
    color: Colors.text,
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
  },
  helper: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  field: {
    gap: 7,
    marginTop: 4,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  label: {
    flex: 1,
    color: Colors.text,
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  unit: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 11,
    paddingHorizontal: 13,
    color: Colors.text,
    backgroundColor: Colors.background,
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  booleanRow: {
    minHeight: 46,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 11,
    backgroundColor: Colors.background,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  booleanText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
});
