// Keyboard-aware ScrollView component with fallback for platforms without the module
import { Platform, ScrollView, ScrollViewProps } from 'react-native';

// Conditionally import the keyboard controller only if available
let KeyboardAwareScrollView: any = ScrollView;
let KeyboardAwareScrollViewProps: any = {};

try {
  const module = require('react-native-keyboard-controller');
  KeyboardAwareScrollView = module.KeyboardAwareScrollView;
  KeyboardAwareScrollViewProps = module.KeyboardAwareScrollViewProps;
} catch {
  // Module not available, use ScrollView as fallback
}

type Props = ScrollViewProps;

export function KeyboardAwareScrollViewCompat({
  children,
  keyboardShouldPersistTaps = 'handled',
  ...props
}: Props) {
  if (Platform.OS === 'web') {
    return (
      <ScrollView keyboardShouldPersistTaps={keyboardShouldPersistTaps} {...props}>
        {children}
      </ScrollView>
    );
  }
  // Use KeyboardAwareScrollView if available, otherwise fallback to ScrollView
  return (
    <KeyboardAwareScrollView keyboardShouldPersistTaps={keyboardShouldPersistTaps} {...props}>
      {children}
    </KeyboardAwareScrollView>
  );
}
