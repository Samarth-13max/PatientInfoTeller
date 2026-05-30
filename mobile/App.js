import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity,
  StyleSheet, ActivityIndicator, AppState
} from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';

const SERVER_URL = 'https://patientinfoteller.onrender.com';

export default function App() {
  const [status, setStatus] = useState('Connecting...');
  const [waiting, setWaiting] = useState(false);
  const [action, setAction] = useState(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);

  const connect = () => {
    const ws = new WebSocket(SERVER_URL.replace('https', 'wss').replace('http', 'ws') + '/socket.io/?EIO=4&transport=websocket');
    
    ws.onopen = () => {
      setConnected(true);
      setStatus('✅ Connected! Waiting for PC...');
    };

    ws.onmessage = (e) => {
      try {
        const msg = e.data;
        if (msg.startsWith('42')) {
          const data = JSON.parse(msg.substring(2));
          if (data[0] === 'scan_fingerprint') {
            setAction(data[1].action);
            setWaiting(true);
            setStatus('⚡ PC requesting scan!');
          }
        }
        if (msg === '2') ws.send('3');
      } catch(err) {}
    };

    ws.onclose = () => {
      setConnected(false);
      setStatus('❌ Disconnected. Reconnecting...');
      setTimeout(connect, 3000);
    };

    ws.onerror = () => {
      setConnected(false);
      setStatus('❌ Connection error. Retrying...');
    };

    wsRef.current = ws;
  };

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const sendResult = (success, fingerprintId) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const msg = '42' + JSON.stringify(['fingerprint_result', {
        success,
        fingerprintId: fingerprintId || null
      }]);
      wsRef.current.send(msg);
    }
  };

  const scanFingerprint = async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      if (!hasHardware) {
        alert('No fingerprint hardware found!');
        sendResult(false);
        return;
      }
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Scan your fingerprint',
        fallbackLabel: 'Try again',
      });
      if (result.success) {
        const fingerprintId = 'fp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        sendResult(true, fingerprintId);
        setWaiting(false);
        setStatus('✅ Fingerprint sent!');
      } else {
        sendResult(false);
        setWaiting(false);
        setStatus('❌ Scan failed. Waiting for PC...');
      }
    } catch (err) {
      sendResult(false);
      setWaiting(false);
      setStatus('Error: ' + err.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>PatientInfoTeller</Text>
      <Text style={styles.tagline}>Securing Details, Protecting Lives.</Text>
      <View style={[styles.statusBox, connected ? styles.connected : styles.disconnected]}>
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