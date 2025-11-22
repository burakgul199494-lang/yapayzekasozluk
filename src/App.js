import React, { useState, useEffect, useMemo } from "react";
import {
  Search, ArrowLeft, Calendar, AlertCircle, ChevronRight, TrendingUp,
  Box, Activity, CheckCircle2, Truck, Smartphone, Mail, FileText,
  Lock, Save, LogOut, Grid, Plus, Trash2, RotateCcw, Layers,
  RefreshCw, User, Key, UserCog, X, Home, FilePlus, MessageSquare, Eye
} from "lucide-react";

// --- FIREBASE IMPORTS ---
import { initializeApp } from "firebase/app";
import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged,
  updateProfile, updatePassword
} from "firebase/auth";
import {
  getFirestore, collection, doc, addDoc, deleteDoc, onSnapshot,
  query, orderBy, serverTimestamp, writeBatch, getDocs, where
} from "firebase/firestore";

// --- FIREBASE SETUP ---
const firebaseConfig = {
  apiKey: "AIzaSyAeBBWnSENJtqZrySuT5K5TKyQaypVx_Sk",
  authDomain: "yapayzekasozluk-2b59a.firebaseapp.com",
  projectId: "yapayzekasozluk-2b59a",
  storageBucket: "yapayzekasozluk-2b59a.firebasestorage.app",
  messagingSenderId: "167803887390",
  appId: "1:167803887390:web:32306d0fe5b1bb1947330f",
  measurementId: "G-JJ3RNEXG37",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = "kargo-takip-v1";

// --- HELPERS ---
const formatNumber = (num) => {
  if (num === undefined || num === null || num === "") return "-";
  const n = parseFloat(num);
  if (isNaN(n)) return "-";
  return n.toFixed(2).replace(".", ",");
};

const formatDate = (timestamp) => {
  if (!timestamp) return "";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return (
    date.toLocaleDateString("tr-TR") + " " +
    date.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })
  );
};

const MONTH_NAMES = ["", "Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

const METRIC_TYPES = [
  { id: "teslimPerformansi", label: "Teslim Perf. %", color: "blue" },
  { id: "rotaOrani", label: "Rota Oranı %", color: "indigo" },
  { id: "tvsOrani", label: "TVS Oranı %", color: "indigo" },
  { id: "checkInOrani", label: "Check-in %", color: "indigo" },
  { id: "smsOrani", label: "SMS Oranı %", color: "orange" },
  { id: "eAtfOrani", label: "E-ATF Oranı %", color: "orange" },
  { id: "elektronikIhbar", label: "E-İhbar %", color: "orange" },
  { id: "gelenKargo", label: "Gelen Kargo", color: "green" },
  { id: "gidenKargo", label: "Giden Kargo", color: "green" },
];

const UNITS = [
  "BÖLGE", "ADASAN", "ADATEPE", "ALAÇATI", "ARMUTALAN", "ASTİM", "AYDIN DDN", "AYRANCILAR",
  "BELDİBİ", "BELEN", "ÇAMKÖY", "ÇEŞME", "ÇİNE", "DALAMAN", "DATÇA", "DAVUTLAR", "DİDİM",
  "DOKUZEYLÜL", "EFELER", "EGESER", "FETHİYE", "GÖCEK", "GÖLKÖY", "GÜMÜŞLÜK", "GÜNDOĞAN",
  "GÜVERCİNLİK", "HALİKARNAS", "KALABAK DDN", "KARYA", "KAYMAKKUYU", "KISIKKÖY", "KONACIK",
  "KÖTEKLİ", "KÖYCEĞİZ", "KUŞADASI", "LİKYA", "LİMANTEPE İRT", "LODOS DDN", "MARMARİS İRT",
  "MENDERES", "MİLAS", "MORDOĞAN", "MUMCULAR", "NAZİLLİ", "NYSA", "ORTACA", "ORTAKENT",
  "ÖDEMİŞ", "RÜZGAR", "SARNIÇ", "SELÇUK", "SÖKE", "ŞİRİNYER", "TEPEKÖY", "TINAZTEPE",
  "TİRE", "TORBA DDN", "TORBALI", "TURGUTREİS", "UMURBEY", "URLA", "ÜÇGÖZLER", "YALIKAVAK",
  "YATAĞAN", "YELKEN", "YENİGÜN", "YENİHİSAR", "ZEYBEK"
];

// --- COMPONENTS ---

const KPICard = ({ title, value, suffix = "", color = "slate", icon: Icon }) => (
  <div className={`bg-white p-2.5 rounded-xl border shadow-sm flex flex-col justify-between relative overflow-hidden min-h-[90px] ${color === "red" ? "border-red-200 bg-red-50" : "border-slate-100"}`}>
    <div className={`absolute top-1 right-1 opacity-20 ${color === "red" ? "text-red-500" : `text-${color}-500`}`}>
      {Icon && <Icon size={24} />}
    </div>
    <span className="text-slate-500 text-[9px] font-bold uppercase tracking-wider z-10 leading-tight">{title}</span>
    <div className="flex items-baseline mt-2 z-10">
      <span className={`text-lg font-bold ${color === "red" ? "text-red-600" : `text-${color}-600`}`}>{formatNumber(value)}</span>
      <span className="text-slate-400 ml-0.5 text-[10px]">{suffix}</span>
    </div>
  </div>
);

const AdminPanel = ({ allData, onSaveBatch, onClose, availableYears, setAvailableYears, isSaving, isLoadingData }) => {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMetric, setSelectedMetric] = useState("teslimPerformansi");
  const [gridData, setGridData] = useState({});
  const [pendingChanges, setPendingChanges] = useState(false);
  const [selection, setSelection] = useState({ start: null, end: null, isDragging: false });
  const MONTH_INDICES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  useEffect(() => {
    const newGrid = {};
    UNITS.forEach((unit) => {
      newGrid[unit] = {};
      MONTH_INDICES.forEach((month) => {
        const record = allData.find(
          (d) => d.unit === unit && d.year === parseInt(selectedYear) && d.month === month
        );
        newGrid[unit][month] = record ? record[selectedMetric] ?? "" : "";
      });
    });
    setGridData(newGrid);
    setPendingChanges(false);
  }, [selectedYear, selectedMetric, allData]);

  useEffect(() => {
    const handleWindowMouseUp = () => {
      if (selection.isDragging) setSelection((prev) => ({ ...prev, isDragging: false }));
    };
    window.addEventListener("mouseup", handleWindowMouseUp);
    return () => window.removeEventListener("mouseup", handleWindowMouseUp);
  }, [selection.isDragging]);

  const handleInputChange = (unit, month, value) => {
    setGridData((prev) => ({ ...prev, [unit]: { ...prev[unit], [month]: value } }));
    setPendingChanges(true);
  };

  const handleMouseDown = (r, c) => { setSelection({ start: { r, c }, end: { r, c }, isDragging: true }); };
  const handleMouseEnter = (r, c) => { if (selection.isDragging) setSelection((prev) => ({ ...prev, end: { r, c } })); };
  const isCellSelected = (r, c) => {
    if (!selection.start || !selection.end) return false;
    const minR = Math.min(selection.start.r, selection.end.r), maxR = Math.max(selection.start.r, selection.end.r);
    const minC = Math.min(selection.start.c, selection.end.c), maxC = Math.max(selection.start.c, selection.end.c);
    return r >= minR && r <= maxR && c >= minC && c <= maxC;
  };

  const handlePaste = (e, startUnitIndex, startMonthIndex) => {
    e.preventDefault();
    const clipboardData = e.clipboardData.getData("text");
    const rows = clipboardData.split(/\r\n|\n|\r/).filter((row) => row.trim() !== "");
    setGridData((prev) => {
      const newData = { ...prev };
      rows.forEach((row, rowIndex) => {
        const targetUnitIndex = startUnitIndex + rowIndex;
        if (targetUnitIndex >= UNITS.length) return;
        const unitName = UNITS[targetUnitIndex];
        const cells = row.split("\t");
        if (!newData[unitName]) newData[unitName] = {};
        cells.forEach((cellValue, cellIndex) => {
          const targetMonthArrIndex = startMonthIndex + cellIndex;
          if (targetMonthArrIndex >= MONTH_INDICES.length) return;
          const month = MONTH_INDICES[targetMonthArrIndex];
          let cleanValue = cellValue.trim().replace(",", ".");
          if (cleanValue === "") cleanValue = "";
          newData[unitName][month] = cleanValue;
        });
      });
      return newData;
    });
    setPendingChanges(true);
  };

  const handleSave = async () => {
    let recordsToUpdate = [];
    UNITS.forEach((unit) => {
      const unitRow = gridData[unit] || {};
      MONTH_INDICES.forEach((month) => {
        const rawValue = unitRow[month];
        if (rawValue === undefined || rawValue === null || rawValue === "") return;
        const cleanStr = String(rawValue).trim().replace(",", ".");
        if (cleanStr === "") return;
        const parsed = parseFloat(cleanStr);
        if (Number.isNaN(parsed)) return;
        const finalValue = selectedMetric.includes("Kargo") ? Math.round(parsed) : Number(parsed.toFixed(2));
        recordsToUpdate.push({
          unit, year: parseInt(selectedYear), month, [selectedMetric]: finalValue,
        });
      });
    });
    if (recordsToUpdate.length === 0) {
      alert("Kaydedilecek veri bulunamadı.");
      return;
    }
    await onSaveBatch(recordsToUpdate);
  };

  if (isLoadingData) return <div className="fixed inset-0 bg-white z-50 flex items-center justify-center"><RefreshCw className="animate-spin" /> Yükleniyor...</div>;

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      <div className="bg-slate-900 text-white px-4 py-3 flex justify-between items-center">
        <h2 className="font-bold flex gap-2"><Grid /> Veri Girişi</h2>
        <div className="flex gap-2">
          <button onClick={handleSave} disabled={isSaving} className="bg-blue-600 px-4 py-2 rounded flex gap-2 items-center">{isSaving ? <RefreshCw className="animate-spin"/> : <Save/>} Kaydet</button>
          <button onClick={onClose} className="bg-slate-700 px-4 py-2 rounded">Kapat</button>
        </div>
      </div>
      <div className="bg-slate-100 p-2 border-b flex gap-4 items-center">
         <select value={selectedYear} onChange={(e)=>setSelectedYear(e.target.value)} className="p-1 rounded font-bold">
            {availableYears.map(y=><option key={y} value={y}>{y}</option>)}
         </select>
         <div className="flex gap-2 overflow-x-auto">{METRIC_TYPES.map(m=><button key={m.id} onClick={()=>setSelectedMetric(m.id)} className={`px-3 py-1 rounded text-xs font-bold ${selectedMetric===m.id ? 'bg-slate-800 text-white' : 'bg-white'}`}>{m.label}</button>)}</div>
      </div>
      <div className="flex-1 overflow-auto bg-white">
         <table className="w-full text-sm border-collapse">
            <thead className="bg-slate-200 sticky top-0 z-10">
               <tr>
                  <th className="p-2 sticky left-0 bg-slate-200 border-r w-40">Birim</th>
                  {MONTH_INDICES.map(m=><th key={m} className="border-r w-24">{MONTH_NAMES[m]}</th>)}
               </tr>
            </thead>
            <tbody>
               {UNITS.map((unit, r)=>(
                  <tr key={unit} className="border-b">
                     <td className="p-2 font-bold sticky left-0 bg-white border-r">{unit}</td>
                     {MONTH_INDICES.map((m, c)=>(
                        <td key={m} className="border-r p-0">
                           <input 
                              className={`w-full p-2 text-center outline-none ${isCellSelected(r,c) ? 'bg-blue-100' : ''}`} 
                              value={gridData[unit]?.[m] || ""} 
                              onChange={(e)=>handleInputChange(unit, m, e.target.value)}
                              onPaste={(e)=>handlePaste(e, r, c)}
                              onMouseDown={()=>handleMouseDown(r, c)}
                              onMouseEnter={()=>handleMouseEnter(r, c)}
                           />
                        </td>
                     ))}
                  </tr>
               ))}
            </tbody>
         </table>
      </div>
    </div>
  );
};

// --- MAIN APP ---

export default function App() {
  const [view, setView] = useState("menu");
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [allData, setAllData] = useState([]);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [availableYears, setAvailableYears] = useState([2024, 2025]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [isAdminOpen, setAdminOpen] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [password, setPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // --- YENİ OPTİMİZE EDİLMİŞ VERİ OKUMA (QUOTA DOSTU) ---
  useEffect(() => {
    if (!user) { setAllData([]); return; }

    const loadData = async () => {
      try {
        // TÜM YILLARI TEK SEFERDE ÇEK (Performance Records içindeki tüm dökümanlar)
        // Yapı: performance_records -> {YEAR}_{UNIT} (Doc ID)
        const q = query(collection(db, "performance_records")); 
        const snapshot = await getDocs(q);

        const parsedData = [];
        
        snapshot.docs.forEach(doc => {
           const docData = doc.data();
           const { unit, year } = docData;
           // DocData içinde "1", "2", "3" gibi ay keyleri var. Bunları düzleştiriyoruz.
           for (let m = 1; m <= 12; m++) {
              if (docData[m]) {
                 parsedData.push({
                    id: `${year}-${unit}-${m}`,
                    unit: unit,
                    year: Number(year),
                    month: m,
                    ...docData[m]
                 });
              }
           }
        });

        setAllData(parsedData);
      } catch (e) {
        console.error("Load data error:", e);
      }
    };
    loadData();
  }, [user]); // Sadece user değişince veya sayfa ilk açılınca yükle

  // --- YENİ OPTİMİZE EDİLMİŞ BATCH KAYIT (QUOTA DOSTU) ---
  const handleSaveBatch = async (records) => {
    setIsSaving(true);
    try {
      const batch = writeBatch(db);
      
      // Verileri Grupla: { "2024_BÖLGE": { 1: {...}, 2: {...} } }
      const groupedUpdates = {};

      records.forEach(r => {
         const docId = `${r.year}_${r.unit}`;
         if (!groupedUpdates[docId]) {
            groupedUpdates[docId] = { 
               unit: r.unit, 
               year: r.year 
               // merge true ile önceki ayları koruyacağız
            };
         }
         
         // Metrikleri ayın içine koy
         // Firestore'da update yaparken "1.teslimPerformansi": 90 şeklinde dot notation kullanacağız
         // Ama burada sıfırdan set ediyormuş gibi yaparsak önceki veriler gider mi?
         // Merge: true ile set edeceğiz.
         
         // Temiz obje oluştur
         const metrics = {};
         METRIC_TYPES.forEach(m => {
            if (r[m.id] !== undefined) metrics[m.id] = r[m.id];
         });

         groupedUpdates[docId][r.month] = metrics;
      });

      // Batch içine ekle
      Object.keys(groupedUpdates).forEach(docId => {
         const ref = doc(db, "performance_records", docId);
         batch.set(ref, groupedUpdates[docId], { merge: true });
      });

      await batch.commit();
      alert("✅ Veriler başarıyla kaydedildi (Optimize Edilmiş Mod)");
      // Sayfayı yenilemeden veriyi güncellemek için loadData'yı tekrar çağırmak yerine
      // state'i manuel güncelleyebiliriz ama şimdilik basit tutalım.
      window.location.reload(); 

    } catch (e) {
      console.error("Save Error:", e);
      alert("Hata: " + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUnitClick = (unit) => {
    setSelectedUnit(unit);
    const unitData = allData.filter((d) => d.unit === unit);
    if (unitData.length > 0) {
      const sorted = unitData.sort((a, b) => b.year - a.year || b.month - a.month);
      setSelectedYear(sorted[0].year);
      setSelectedMonth(sorted[0].month);
    }
    setView("detail");
  };

  const currentData = useMemo(() => {
    return allData.find(d => d.unit === selectedUnit && d.year === selectedYear && d.month === selectedMonth);
  }, [allData, selectedUnit, selectedYear, selectedMonth]);

  // --- LOGIN / LOGOUT ---
  const handleLogin = async (e) => { e.preventDefault(); setLoginLoading(true); try { await signInWithEmailAndPassword(auth, e.target[0].value, e.target[1].value); setView("menu"); } catch(err){ alert("Giriş başarısız"); } finally { setLoginLoading(false); }};
  
  if (authLoading) return <div className="flex h-screen items-center justify-center"><RefreshCw className="animate-spin"/></div>;
  
  if (!user) return (
    <div className="flex h-screen items-center justify-center bg-slate-900 p-4">
      <form onSubmit={handleLogin} className="bg-white p-8 rounded-xl w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-center">Giriş Yap</h1>
        <input type="email" required placeholder="E-Posta" className="w-full border p-3 rounded mb-4"/>
        <input type="password" required placeholder="Şifre" className="w-full border p-3 rounded mb-6"/>
        <button disabled={loginLoading} className="w-full bg-blue-600 text-white py-3 rounded font-bold">{loginLoading ? "..." : "Giriş"}</button>
      </form>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 safe-area-pb">
      {view === "menu" && (
         <div className="flex flex-col h-screen items-center justify-center gap-6">
            <h1 className="text-2xl font-bold">Operasyon Portalı</h1>
            <button onClick={()=>setShowLoginModal(true)} className="bg-white p-6 rounded-xl shadow border w-64 flex flex-col items-center gap-3 hover:border-blue-400"><Lock size={32}/> Admin Girişi</button>
            <button onClick={()=>setView("dashboard")} className="bg-white p-6 rounded-xl shadow border w-64 flex flex-col items-center gap-3 hover:border-blue-400"><Activity size={32}/> Birimler</button>
            <button onClick={()=>signOut(auth)} className="text-red-500 mt-4 font-bold">Çıkış Yap</button>
         </div>
      )}

      {view === "dashboard" && (
         <div className="p-4">
            <div className="flex items-center gap-2 mb-4"><button onClick={()=>setView("menu")}><Home/></button> <input placeholder="Ara..." value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} className="bg-white p-2 rounded border flex-1"/></div>
            {UNITS.filter(u=>u.toLowerCase().includes(searchQuery.toLowerCase())).map(u=>(
               <div key={u} onClick={()=>handleUnitClick(u)} className="bg-white p-4 mb-2 rounded shadow flex justify-between items-center cursor-pointer">
                  <span className="font-bold">{u}</span> <ChevronRight className="text-slate-400"/>
               </div>
            ))}
         </div>
      )}

      {view === "detail" && (
         <div className="pb-10">
            <div className="bg-white p-4 sticky top-0 shadow z-10">
               <div className="flex items-center gap-2 mb-2">
                  <button onClick={()=>setView("dashboard")}><ArrowLeft/></button>
                  <h2 className="text-xl font-bold">{selectedUnit}</h2>
               </div>
               <div className="flex gap-2 overflow-x-auto">
                  <select value={selectedYear} onChange={e=>setSelectedYear(Number(e.target.value))} className="bg-slate-100 p-1 rounded font-bold">
                     {availableYears.map(y=><option key={y} value={y}>{y}</option>)}
                  </select>
                  {MONTH_NAMES.map((m,i)=>i>0 && <button key={i} onClick={()=>setSelectedMonth(i)} className={`px-3 py-1 rounded text-sm ${selectedMonth===i ? 'bg-slate-800 text-white' : 'bg-slate-100'}`}>{m}</button>)}
               </div>
            </div>
            <div className="p-4 space-y-4">
               {currentData ? (
                  <>
                     <div className={`p-6 rounded-2xl text-white shadow-lg ${currentData.teslimPerformansi<94 ? 'bg-red-600' : 'bg-blue-600'}`}>
                        <div className="text-xs opacity-80">TESLİM PERFORMANSI</div>
                        <div className="text-4xl font-bold">{formatNumber(currentData.teslimPerformansi)}%</div>
                     </div>
                     <div className="grid grid-cols-2 gap-3">
                        {METRIC_TYPES.filter(m=>m.id!=='teslimPerformansi').map(metric=>(
                           <div key={metric.id} className="bg-white p-3 rounded border">
                              <div className="text-xs text-slate-500 uppercase">{metric.label}</div>
                              <div className="text-lg font-bold">{formatNumber(currentData[metric.id])}</div>
                           </div>
                        ))}
                     </div>
                  </>
               ) : <div className="text-center py-10 text-slate-400">Veri yok</div>}
            </div>
         </div>
      )}

      {isAdminOpen && (
        <AdminPanel 
          allData={allData} 
          onSaveBatch={handleSaveBatch} 
          onClose={()=>{setAdminOpen(false); setView("menu");}} 
          availableYears={availableYears}
          setAvailableYears={setAvailableYears}
          isSaving={isSaving}
        />
      )}

      {showLoginModal && (
         <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-6 rounded-xl w-full max-w-sm">
               <h3 className="font-bold mb-4">Admin Şifresi</h3>
               <input type="password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full border p-2 rounded mb-4"/>
               <div className="flex justify-end gap-2">
                  <button onClick={()=>setShowLoginModal(false)} className="text-slate-500">İptal</button>
                  <button onClick={()=>{if(password==="Marvel3535"){setShowLoginModal(false); setAdminOpen(true); setPassword("");}else{alert("Hatalı");}}} className="bg-blue-600 text-white px-4 py-2 rounded">Giriş</button>
               </div>
            </div>
         </div>
      )}
    </div>
  );
}
