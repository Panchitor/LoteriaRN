import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ActivityIndicator, Platform, Image } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import LoginScreen from './src/screens/LoginScreen';
import PlayerScreen from './src/screens/PlayerScreen';

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  const saveToken = async (val: string) => {
    if (Platform.OS === 'web') localStorage.setItem('auth_token', val);
    else await SecureStore.setItemAsync('auth_token', val);
  };
  const getToken = async () => {
    if (Platform.OS === 'web') return localStorage.getItem('auth_token');
    return await SecureStore.getItemAsync('auth_token');
  };
  const deleteToken = async () => {
    if (Platform.OS === 'web') localStorage.removeItem('auth_token');
    else await SecureStore.deleteItemAsync('auth_token');
  };

  useEffect(() => {
    async function checkAuth() {
      try {
        const storedToken = await getToken();
        if (storedToken) setToken(storedToken);
      } catch (e) {
        console.error("Storage error:", e);
      } finally {
        setIsReady(true);
      }
    }
    checkAuth();
  }, []);

  const handleLoginSuccess = async (newToken: string) => {
    try {
      await saveToken(newToken);
      setToken(newToken);
    } catch(e) {
      console.error("Save error:", e);
      // Fallback UI unlock if storage fails
      setToken(newToken); 
    }
  };

  const handleLogout = async () => {
    await deleteToken();
    setToken(null);
  };

  if (!isReady) {
    return (
      <View style={styles.splash}>
        <Image 
          source={require('./assets/icon.png')} 
          style={styles.splashLogo} 
          resizeMode="contain" 
        />
        <ActivityIndicator size="large" color="#10b981" style={{ marginTop: 20 }} />
        <Text style={styles.splashText}>Cargando Lotería RN...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, height: '100%', width: '100%' }}>
      {token ? (
        <PlayerScreen token={token} onLogout={handleLogout} />
      ) : (
        <LoginScreen onLogin={handleLoginSuccess} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
  },
  splashLogo: {
    width: '85%',
    maxWidth: 900,
    height: 200,
    marginBottom: 20,
  },
  splashText: {
    color: '#ffffff',
    marginTop: 20,
    fontSize: 24,
    fontWeight: 'bold',
  },
});
