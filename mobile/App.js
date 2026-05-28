import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity,
  StyleSheet, ActivityIndicator
} from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { io } from 'socket.io-client';

const SERVER_URL = 'http://192.168.108.24:3000';

export default function App() {
  const [socket, setSocket] = useState(null);
  const [status, setStatus] = useState('Connecting...');
  const [waiting, setWaiting] = useState(false);
  const [action, setAction] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const s = io(SERVER_URL, { transports: ['websocket'] });
    s.on('connect', () => {
      setConnected(true);
      setStatus('Connected! Waiting for PC...');
    });
    s.on('disconnect', () => {
      setConnected(false);
      setStatus('Disconnected. Reconnecting...');
    });
    s.on('scan_fingerprint', (data) => {
      setAction(data.action);
      setWaiting(true);
      setStatus('PC requesting fingerprint scan!');
    });
    setSocket(s);
    return () => s.disconnect();
  }, []);

  const scanFingerprint = async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Scan your fingerprint',
        fallbackLabel: 'Try again',
      });
      if (result.success) {
        const fingerprintId = 'fp_' + Date.now() + '_' + Math.random().toString(36).substr(2,9);
        socket.emit('fingerprint_result', {
          success: true,
          fingerprintId: fingerprintId
        });
        setWaiting(false);
        setStatus('✅ Fingerprint sent! Waiting for PC...');
      } else {
        socket.emit('fingerprint_result', { success: false });
        setWaiting(false);
        setStatus('❌ Scan failed. Waiting for PC...');
      }
    } catch (err) {
      socket.emit('fingerprint_result', { success: false });
      setWaiting(false);
      setStatus('Error: ' + err.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>PatientInfoTeller</Text>
      <Text style={styles.tagline}>Securing Details, Protecting Lives.</Text>

      <View style={[styles.statusBox,
        connected ? styles.connected : styles.disconnected]}>
        <Text style={styles.statusText}>{status}</Text>
      </View>

      {waiting && (
        <View style={styles.scanBox}>
          <ActivityIndicator size="large" color="#1a6fc4"/>
          <Text style={styles.scanText}>PC wants fingerprint scan!</Text>
          <Text style={styles.actionText}>Action: {action}</Text>
          <TouchableOpacity style={styles.scanBtn} onPress={scanFingerprint}>
            <Text style={styles.scanBtnText}>SCAN FINGERPRINT</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:{flex:1,backgroundColor:'#f0f4f8',alignItems:'center',
    justifyContent:'center',padding:24},
  title:{fontSize:26,fontWeight:'bold',color:'#1a6fc4',marginBottom:6},
  tagline:{fontSize:13,color:'#1a6fc4',textDecorationLine:'underline',
    marginBottom:30},
  statusBox:{padding:16,borderRadius:10,width:'100%',
    alignItems:'center',marginBottom:20},
  connected:{backgroundColor:'#eafaf1',borderColor:'#27ae60',borderWidth:2},
  disconnected:{backgroundColor:'#fdedec',borderColor:'#e74c3c',borderWidth:2},
  statusText:{fontSize:15,fontWeight:'bold',textAlign:'center'},
  scanBox:{width:'100%',backgroundColor:'white',borderRadius:12,padding:24,
    alignItems:'center',elevation:4},
  scanText:{fontSize:17,fontWeight:'bold',marginTop:12,marginBottom:6,
    textAlign:'center'},
  actionText:{fontSize:13,color:'#666',marginBottom:20},
  scanBtn:{backgroundColor:'#1a6fc4',padding:16,borderRadius:8,
    width:'100%',alignItems:'center'},
  scanBtnText:{color:'white',fontWeight:'bold',fontSize:15},
});