// components/ExternalLink.tsx
import React from 'react';
import { Platform, Pressable, Text, Linking, GestureResponderEvent } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

type ExternalLinkProps = {
  href: string;
  children: React.ReactNode;
  style?: any;
};

export default function ExternalLink({ href, children, style }: ExternalLinkProps) {
  const onPress = async (e: GestureResponderEvent) => {
    e?.preventDefault?.();
    try {
      if (Platform.OS === 'web') {
        window.open(href, '_blank', 'noopener,noreferrer');
      } else {
        await WebBrowser.openBrowserAsync(href);
      }
    } catch {
      // Fallback
      Linking.openURL(href);
    }
  };

  // Native: pressable
  if (Platform.OS !== 'web') {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }, style]}>
        {typeof children === 'string' ? <Text>{children}</Text> : children}
      </Pressable>
    );
  }

  // Web: real <a> for better UX/SEO
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
      {typeof children === 'string' ? <Text style={style}>{children}</Text> : children}
    </a>
  );
}
