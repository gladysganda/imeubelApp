// screens/ShipmentListScreen.js
import { collection, doc, getDoc, onSnapshot, orderBy, query, updateDoc, where } from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Button, FlatList, StyleSheet, Text, TextInput, View } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { db } from "../firebase";

function money(n){const v=Number(n)||0;try{return new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(v);}catch{return `Rp ${Math.round(v).toLocaleString("id-ID")}`;}}

export default function ShipmentListScreen({ route }){
  const initialProductId = route?.params?.productId || null;

  const [date, setDate] = useState(""); // filter shipmentDate
  const [loading,setLoading]=useState(true);
  const [rows,setRows]=useState([]);    // reservations joined w/ order totals

  useEffect(()=>{
    // pending reservations; optionally filter by shipmentDate and product
    const wheres = [ where("status","==","pending") ];
    if (date) wheres.push(where("shipmentDate","==",date));
    const qy = query(collection(db,"reservations"), ...wheres, orderBy("createdAt","desc"));
    const unsub = onSnapshot(qy, async (snap)=>{
      const list = snap.docs.map(d=>({id:d.id,...d.data()}))
        .filter(r => initialProductId ? r.productId === initialProductId : true);
      // join salesOrders (for remaining + paymentType)
      const withOrder = await Promise.all(list.map(async r=>{
        let remaining = null, paymentType = null;
        if (r.orderId) {
          const oSnap = await getDoc(doc(db,"salesOrders",r.orderId));
          if (oSnap.exists()) {
            const o = oSnap.data() || {};
            remaining = Number(o?.totals?.remaining ?? 0);
            paymentType = o?.paymentType || null;
          }
        }
        return { ...r, remaining, paymentType };
      }));
      setRows(withOrder); setLoading(false);
    },(e)=>{console.log("shipments sub err",e); setLoading(false);});
    return ()=>unsub();
  },[date,initialProductId]);

  const markDelivered = async (r) =>{
    try{
      await updateDoc(doc(db,"reservations",r.id), { status:"fulfilled" });
      // if you want to auto-complete order when all fulfilled,
      // you could query reservations by orderId here and then update salesOrders/{id}.status
      // kept simple for now
    }catch(e){ alert(e?.message||"Failed to update reservation"); }
  };
  const setPayType = async (r, type) =>{
    try{
      if (!r.orderId) return;
      await updateDoc(doc(db,"salesOrders",r.orderId), { paymentType:type });
    }catch(e){ alert(e?.message||"Failed to update payment type"); }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large"/><Text>Loading…</Text></View>;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Shipments</Text>
      <TextInput style={styles.search} value={date} onChangeText={setDate} placeholder="Filter by date (YYYY-MM-DD) — optional" />
      <FlatList
        data={rows}
        keyExtractor={(r)=>r.id}
        renderItem={({item:r})=>(
          <View style={styles.card}>
            <Text style={styles.rowTitle}>{r.customerName} • {r.productName}{r.size?` (${r.size})`:""} • Qty {r.qty}</Text>
            <Text>Shipment: {r.shipmentDate || "(not set)"}</Text>
            <Text>Order: {r.orderId ? `#${r.orderId.slice(0,6)}`:"-"}</Text>
            {r.remaining != null ? <Text>Remaining: {money(r.remaining)}</Text> : null}
            <View style={{ marginTop: 6 }}>
              <Text style={{ fontWeight:"700", marginBottom:4 }}>Payment type</Text>
              <View style={styles.pickerWrapper}>
                <Picker selectedValue={r.paymentType || ""} onValueChange={(v)=>setPayType(r,v)}>
                  <Picker.Item label="(none)" value="" />
                  <Picker.Item label="Cash" value="cash" />
                  <Picker.Item label="Transfer" value="transfer" />
                  <Picker.Item label="QRIS" value="qris" />
                </Picker>
              </View>
            </View>
            <View style={{ flexDirection:"row", gap:8 }}>
              <Button title="Mark delivered" onPress={()=>markDelivered(r)} />
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles=StyleSheet.create({
  container:{flex:1,padding:12,backgroundColor:"#fff"},
  center:{flex:1,justifyContent:"center",alignItems:"center",backgroundColor:"#fff"},
  title:{fontSize:20,fontWeight:"700",marginBottom:8},
  search:{borderWidth:1,borderColor:"#ccc",borderRadius:8,padding:10,backgroundColor:"#fff",marginBottom:10},
  card:{borderWidth:1,borderColor:"#eee",borderRadius:10,padding:12,marginBottom:10,backgroundColor:"#fff"},
  rowTitle:{fontWeight:"700",marginBottom:4},
  pickerWrapper:{borderWidth:1,borderColor:"#ccc",borderRadius:8,overflow:"hidden",backgroundColor:"#fff",marginBottom:8},
});
