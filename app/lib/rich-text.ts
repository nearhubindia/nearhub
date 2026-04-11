export type RichTextSegment = {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
};

export type RichTextBlock = {
  type: 'paragraph' | 'bullet' | 'empty';
  segments: RichTextSegment[];
};

function createSegment(text: string, styles: Omit<RichTextSegment, 'text'>): RichTextSegment {
  return {
    text,
    bold: styles.bold,
    italic: styles.italic,
    underline: styles.underline,
  };
}

function parseInlineSegments(text: string): RichTextSegment[] {
  const segments: RichTextSegment[] = [];
  let buffer = '';
  let activeStyles = {
    bold: false,
    italic: false,
    underline: false,
  };
  let bufferStyles = { ...activeStyles };

  const flushBuffer = () => {
    if (!buffer) return;
    segments.push(createSegment(buffer, bufferStyles));
    buffer = '';
  };

  for (let index = 0; index < text.length; ) {
    if (text.startsWith('**', index)) {
      flushBuffer();
      activeStyles = { ...activeStyles, bold: !activeStyles.bold };
      bufferStyles = { ...activeStyles };
      index += 2;
      continue;
    }

    if (text.startsWith('__', index)) {
      flushBuffer();
      activeStyles = { ...activeStyles, underline: !activeStyles.underline };
      bufferStyles = { ...activeStyles };
      index += 2;
      continue;
    }

    if (text[index] === '_') {
      flushBuffer();
      activeStyles = { ...activeStyles, italic: !activeStyles.italic };
      bufferStyles = { ...activeStyles };
      index += 1;
      continue;
    }

    if (!buffer) {
      bufferStyles = { ...activeStyles };
    }
    buffer += text[index];
    index += 1;
  }

  flushBuffer();
  return segments;
}

export function parseRichText(text: string): RichTextBlock[] {
  const normalized = String(text || '').replace(/\r\n/g, '\n');

  return normalized.split('\n').map((line) => {
    if (!line.trim()) {
      return {
        type: 'empty',
        segments: [],
      } as RichTextBlock;
    }

    const bulletMatch = line.match(/^\s*•\s*(.*)$/);
    const isBullet = Boolean(bulletMatch);
    const content = isBullet ? bulletMatch?.[1] || '' : line;

    return {
      type: isBullet ? 'bullet' : 'paragraph',
      segments: parseInlineSegments(content),
    };
  });
}

export function stripRichTextFormatting(text: string): string {
  return parseRichText(text)
    .map((block) => block.segments.map((segment) => segment.text).join(''))
    .join('\n')
    .replace(/\s+/g, ' ')
    .trim();
}
