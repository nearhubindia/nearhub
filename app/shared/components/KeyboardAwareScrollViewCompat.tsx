// Keyboard-aware ScrollView component with fallback for platforms without the module
import React from 'react';
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

export const KeyboardAwareScrollViewCompat = React.forwardRef<ScrollView, Props>(
  ({ children, keyboardShouldPersistTaps = 'handled', ...props }, ref) => {
    if (Platform.OS === 'web') {
      return (
        <ScrollView ref={ref} keyboardShouldPersistTaps={keyboardShouldPersistTaps} {...props}>
          {children}
        </ScrollView>
      );
    }

    // Use KeyboardAwareScrollView if available, otherwise fallback to ScrollView
    return (
      <KeyboardAwareScrollView
        ref={ref}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        {...props}
      >
        {children}
      </KeyboardAwareScrollView>
    );
  }
);

KeyboardAwareScrollViewCompat.displayName = 'KeyboardAwareScrollViewCompat';
