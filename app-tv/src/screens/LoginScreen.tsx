import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, Platform, Image } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';
import { fetchWithFailover, saveServerUrls } from '../services/apiClient';

export default function LoginScreen({ onLogin }: { onLogin: (token: string) => void }) {
  const [agencyNumber, setAgencyNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // 0 = Wifi Button, 1 = TextInput, 2 = Submit Button
  const [focusedIndex, setFocusedIndex] = useState<number>(1);

  const handleOpenWifi = async () => {
    if (Platform.OS === 'android') {
      try {
        await IntentLauncher.startActivityAsync((IntentLauncher as any).ActivityAction?.WIFI_SETTINGS || 'android.settings.WIFI_SETTINGS');
      } catch (e) {
        try {
          await IntentLauncher.startActivityAsync('android.settings.SETTINGS');
        } catch (_) {}
      }
    }
  };

  const handleLogin = async () => {
    if (!agencyNumber) {
      setError('Ingrese el número de agencia');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetchWithFailover('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agencyNumber })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Error al vincular el dispositivo");
        setLoading(false);
      } else {
        if (data.primaryApiUrl || data.secondaryApiUrl) {
          await saveServerUrls(data.primaryApiUrl, data.secondaryApiUrl);
        }
        onLogin(data.token);
      }
    } catch (e: any) {
      setError('Fallo de conexión con servidores (Verifique red / DNS)');
      setLoading(false);
    }
  };

  const isWifiFocused = focusedIndex === 0;
  const isInputFocused = focusedIndex === 1;
  const isSubmitFocused = focusedIndex === 2;

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Image
          source={require('../../assets/icon.png')}
          style={styles.logoImage}
          resizeMode="contain"
        />

        <Text style={styles.title}>Lotería RN Agencias</Text>
        <Text style={styles.subtitle}>Registro de Terminal TV</Text>

        {/* 1. BOTON CONFIGURAR WI-FI */}
        <Pressable 
          focusable={true}
          onFocus={() => setFocusedIndex(0)}
          onBlur={() => setFocusedIndex(-1)}
          style={() => [
            styles.wifiButton, 
            isWifiFocused && styles.focusedWifiButton
          ]} 
          onPress={handleOpenWifi}
        >
          {() => (
            <Text style={[styles.wifiButtonText, isWifiFocused && styles.focusedWifiText]}>
              {isWifiFocused ? '👉 📶 CONFIGURAR RED WI-FI 👈' : '📶 CONFIGURAR RED WI-FI'}
            </Text>
          )}
        </Pressable>

        {/* 2. CAMPO NUMERO DE AGENCIA */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Número de Agencia Asociada:</Text>
          <TextInput
            style={[
              styles.input,
              isInputFocused && styles.focusedInput
            ]}
            value={agencyNumber}
            onChangeText={setAgencyNumber}
            onFocus={() => setFocusedIndex(1)}
            keyboardType="numeric"
            placeholder="Ej: 45"
            placeholderTextColor="#64748b"
            autoFocus
          />
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}

        {/* 3. BOTON VINCULAR PANTALLA */}
        <Pressable 
          focusable={true}
          onFocus={() => setFocusedIndex(2)}
          onBlur={() => setFocusedIndex(-1)}
          style={() => [
            styles.button,
            isSubmitFocused && styles.focusedSubmitButton
          ]} 
          onPress={handleLogin}
          disabled={loading}
        >
          {() => (
            loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={[styles.buttonText, isSubmitFocused && styles.focusedSubmitText]}>
                {isSubmitFocused ? '👉 VINCULAR PANTALLA 👈' : 'VINCULAR PANTALLA'}
              </Text>
            )
          )}
        </Pressable>

        <Text style={styles.footer}>Desarrollado por Patagonia Live</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: '92%',
    maxWidth: 750,
    backgroundColor: '#1e293b',
    padding: 40,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 15,
  },
  logoImage: {
    width: '95%',
    height: 160,
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
    marginBottom: 20,
  },
  wifiButton: {
    width: '100%',
    backgroundColor: '#2563eb',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 25,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  wifiButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  focusedWifiButton: {
    backgroundColor: '#fbbf24', // NEON GOLD YELLOW
    borderColor: '#ffffff',
    borderWidth: 6,
    transform: [{ scale: 1.06 }],
  },
  focusedWifiText: {
    color: '#000000', // BLACK TEXT FOR MAX CONTRAST
    fontWeight: '900',
    fontSize: 16,
  },
  inputContainer: {
    width: '100%',
    marginBottom: 20,
  },
  label: {
    color: '#94a3b8',
    marginBottom: 10,
    fontSize: 14,
  },
  input: {
    width: '100%',
    backgroundColor: '#0f172a',
    borderWidth: 3,
    borderColor: '#334155',
    color: '#f8fafc',
    fontSize: 24,
    padding: 15,
    borderRadius: 10,
    textAlign: 'center',
  },
  focusedInput: {
    borderColor: '#38bdf8', // BRIGHT CYAN
    borderWidth: 6,
    backgroundColor: '#1e293b',
    color: '#ffffff',
  },
  errorText: {
    color: '#ef4444',
    marginBottom: 20,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    padding: 10,
    borderRadius: 8,
    width: '100%',
    textAlign: 'center',
  },
  button: {
    width: '100%',
    backgroundColor: '#10b981',
    padding: 18,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  focusedSubmitButton: {
    backgroundColor: '#fbbf24', // NEON GOLD YELLOW
    borderColor: '#ffffff',
    borderWidth: 6,
    transform: [{ scale: 1.06 }],
  },
  focusedSubmitText: {
    color: '#000000', // BLACK TEXT FOR MAX CONTRAST
    fontWeight: '900',
    fontSize: 18,
  },
  footer: {
    marginTop: 30,
    color: '#64748b',
    fontSize: 12,
  }
});
