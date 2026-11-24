import { Text, View } from 'react-native';
import { useTranslations } from 'use-intl';

export default function HomeScreen() {
  const t = useTranslations('home');

  return (
    <View className="flex-1 items-center justify-center bg-berry-50 p-6">
      <Text className="text-center text-3xl font-extrabold text-berry-950">{t('title')}</Text>
    </View>
  );
}
