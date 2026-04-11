import React, { useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Colors from '@/constants/colors';
import { parseRichText } from '@/lib/rich-text';

interface RichTextPreviewProps {
  text: string;
  containerStyle?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  bulletSymbolStyle?: StyleProp<TextStyle>;
}

export default function RichTextPreview({
  text,
  containerStyle,
  textStyle,
  bulletSymbolStyle,
}: RichTextPreviewProps) {
  const blocks = useMemo(() => parseRichText(text), [text]);

  return (
    <View style={containerStyle}>
      {blocks.map((block, index) => {
        if (block.type === 'empty') {
          return <View key={`blank-${index}`} style={styles.blankLine} />;
        }

        const inlineSegments = block.segments.map((segment, segmentIndex) => {
          return (
            <Text
              key={`segment-${index}-${segmentIndex}`}
              style={[
                styles.segment,
                textStyle,
                segment.bold && styles.boldSegment,
                segment.italic && styles.italicSegment,
                segment.underline && styles.underlineSegment,
              ]}
            >
              {segment.text}
            </Text>
          );
        });

        if (block.type === 'bullet') {
          return (
            <View key={`bullet-${index}`} style={styles.bulletRow}>
              <Text style={[styles.bulletSymbol, bulletSymbolStyle]}>•</Text>
              <Text style={[styles.paragraphText, textStyle]}>{inlineSegments}</Text>
            </View>
          );
        }

        return (
          <Text key={`paragraph-${index}`} style={[styles.paragraphText, textStyle]}>
            {inlineSegments}
          </Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  paragraphText: {
    color: Colors.text,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: 'Inter_400Regular',
    marginBottom: 4,
  },
  segment: {
    color: Colors.text,
  },
  boldSegment: {
    fontFamily: 'Inter_700Bold',
  },
  italicSegment: {
    fontStyle: 'italic',
  },
  underlineSegment: {
    textDecorationLine: 'underline',
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  bulletSymbol: {
    width: 16,
    marginTop: 1,
    color: Colors.primary,
    fontSize: 15,
    lineHeight: 21,
    fontFamily: 'Inter_700Bold',
  },
  blankLine: {
    height: 8,
  },
});
