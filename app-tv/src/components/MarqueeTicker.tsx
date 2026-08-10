import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, Easing, Dimensions, StyleSheet } from 'react-native';

interface MarqueeTickerProps {
  text: string;
  speed?: number; // 30 (lento) a 100 (rápido)
  position?: 'top' | 'bottom';
  bgColor?: string;
  textColor?: string;
}

export function MarqueeTicker({
  text,
  speed = 50,
  position = 'bottom',
  bgColor = 'rgba(0,0,0,0.85)',
  textColor = '#FFFFFF',
}: MarqueeTickerProps) {
  const animatedValue = useRef(new Animated.Value(0)).current;
  const screenWidth = Dimensions.get('window').width || 1920;

  useEffect(() => {
    // Duration based on text length and speed parameter
    const duration = Math.max(8000, (text.length * 250) * (100 / (speed || 50)));

    const startAnimation = () => {
      animatedValue.setValue(screenWidth);
      Animated.loop(
        Animated.timing(animatedValue, {
          toValue: -screenWidth - (text.length * 15),
          duration: duration,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    };

    startAnimation();
  }, [text, speed, screenWidth]);

  return (
    <View
      style={[
        styles.container,
        position === 'top' ? { top: 0 } : { bottom: 0 },
        { backgroundColor: bgColor },
      ]}
    >
      <Animated.View
        style={{
          transform: [{ translateX: animatedValue }],
        }}
      >
        <Text style={[styles.text, { color: textColor }]}>
          {text}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 54,
    justifyContent: 'center',
    overflow: 'hidden',
    zIndex: 999,
  },
  text: {
    fontSize: 24,
    fontWeight: 'bold',
  },
});
