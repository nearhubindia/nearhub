import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import Colors from '@/constants/colors';
import AiValuator from '@/features/ai-valuator/screens/AiValuator';
import { useAuth } from '@/shared/contexts/auth-context';
import AuthRequiredState from '@/shared/components/AuthRequiredState';

export default function AiValuatorRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <AuthRequiredState message="Please sign in to generate an AI mobile valuation" />;
  }

  return <AiValuator />;
}
