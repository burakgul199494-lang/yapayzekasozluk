import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Search, ArrowLeft, Calendar, AlertCircle, ChevronRight, TrendingUp,
  Box, Activity, CheckCircle2, Truck, Smartphone, Mail, FileText, Lock, Save,
  LogOut, Grid, Plus, Trash2, RotateCcw, Layers,
  RefreshCw, User, Key, UserCog, X, Home, FilePlus, MessageSquare, Eye
} from "lucide-react";

// --- FIREBASE IMPORTS ---
import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  updatePassword,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  addDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp
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
  return date.toLocaleDateString("tr-TR") + " " + date.toLocaleTimeString("tr-TR", { hour: '2-digit', minute: '2-digit' });
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
  "BÖLGE", "ADASAN", "ADATEPE", "ALAÇATI", "ARMUTALAN", "ASTİM", "AYDIN DDN", "AYRANCILAR", "BELDİBİ", "BELEN",
  "ÇAMKÖY", "ÇEŞME", "ÇİNE", "DALAMAN", "DATÇA", "DAVUTLAR", "DİDİM", "DOKUZEYLÜL", "EFELER", "EGESER",
  "FETHİYE", "GÖCEK", "GÖLKÖY", "GÜMÜŞLÜK", "GÜNDOĞAN", "GÜVERCİNLİK", "HALİKARNAS", "KALABAK DDN", "KARYA",
  "KAYMAKKUYU", "KISIKKÖY", "KONACIK", "KÖTEKLİ", "KÖYCEĞİZ", "KUŞADASI", "LİKYA", "LİMANTEPE İRT", "LODOS DDN",
  "MARMARİS İRT", "MENDERES", "MİLAS", "MORDOĞAN", "MUMCULAR", "NAZİLLİ", "NYSA", "ORTACA", "ORTAKENT", "ÖDEMİŞ",
  "RÜZGAR", "SARNIÇ", "SELÇUK", "SÖKE", "ŞİRİNYER", "TEPEKÖY", "TINAZTEPE", "TİRE", "TORBA DDN", "TORBALI",
  "TURGUTREİS", "UMURBEY", "URLA", "ÜÇGÖZLER", "YALIKAVAK", "YATAĞAN", "YELKEN", "YENİGÜN", "YENİHİSAR", "ZEYBEK",
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

// --- ADMIN PANEL (SADELEŞTİRİLMİŞ) ---
const AdminPanel = ({ allData, onSaveBatch, onClose, availableYears, setAvailableYears, isSaving }) => {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMetric, setSelectedMetric] = useState("teslimPerformansi");
  const [gridData, setGridData] = useState({});
  const [pendingChanges, setPendingChanges] = useState(false);
  const [selection, setSelection] = useState({ start: null, end: null, isDragging: false });
  const MONTH_INDICES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  // Veriyi Hazırla
  useEffect(() => {
    const newGrid = {};
    UNITS.forEach((unit) => {
      newGrid[unit] = {};
      MONTH_INDICES.forEach((month) => {
        const record = allData.find((d) => d.unit === unit && d.year === parseInt(selectedYear) && d.month === month);
        newGrid[unit][month] = record ? record[selectedMetric] ?? "" : "";
      });
    });
    setGridData(newGrid);
    setPendingChanges(false); // Yıl veya metrik değişince pending state'i sıfırla
  }, [selectedYear, selectedMetric, allData]);

  // Global mouse up
  useEffect(() => {
    const handleWindowMouseUp = () => { if (selection.isDragging) setSelection((prev) => ({ ...prev, isDragging: false })); };
    window.addEventListener("mouseup", handleWindowMouseUp);
    return () => window.removeEventListener("mouseup", handleWindowMouseUp);
  }, [selection.isDragging]);

  const handleInputChange = (unit, month, value) => {
    setGridData((prev) => ({ ...prev, [unit]: { ...prev[unit], [month]: value } }));
    setPendingChanges(true); // Değişiklik olduğunu işaretle
  };
  
  const handleMouseDown = (r, c) => { setSelection({ start: { r, c }, end: { r, c }, isDragging: true }); };
  const handleMouseEnter = (r, c) => { if (selection.isDragging) setSelection((prev) => ({ ...prev, end: { r, c } })); };
  const isCellSelected = (r, c) => {
    if (!selection.start || !selection.end) return false;
    const minR = Math.min(selection.start.r, selection.end.r); const maxR = Math.max(selection.start.r, selection.end.r);
    const minC = Math.min(selection.start.c, selection.end.c); const maxC = Math.max(selection.start.c, selection.end.c);
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

    const handleKeyDown = (e, unitIndex, monthIndex) => {
        if (e.key === "Delete") {
            e.preventDefault();
            if (selection.start && selection.end) {
              const minR = Math.min(selection.start.r, selection.end.r); const maxR = Math.max(selection.start.r, selection.end.r);
              const minC = Math.min(selection.start.c, selection.end.c); const maxC = Math.max(selection.start.c, selection.end.c);
              setGridData((prev) => {
                const newData = { ...prev };
                for (let r = minR; r <= maxR; r++) {
                  const unitName = UNITS[r];
                  if (newData[unitName]) { newData[unitName] = { ...newData[unitName] }; for (let c = minC; c <= maxC; c++) { const month = MONTH_INDICES[c]; newData[unitName][month] = ""; } }
                }
                return newData;
              });
              setPendingChanges(true);
            } else { const month = MONTH_INDICES[monthIndex]; handleInputChange(UNITS[unitIndex], month, ""); }
            return;
        }
        let nextUnitIndex = unitIndex; let nextMonthIndex = monthIndex; let move = false;
        if (e.key === "ArrowRight") { move = true; if (monthIndex < 11) nextMonthIndex++; }
        else if (e.key === "ArrowLeft") { move = true; if (monthIndex > 0) nextMonthIndex--; }
        else if (e.key === "ArrowDown") { move = true; if (unitIndex < UNITS.length - 1) nextUnitIndex++; }
        else if (e.key === "ArrowUp") { move = true; if (unitIndex > 0) nextUnitIndex--; }
        if (move) {
            e.preventDefault();
            const month = MONTH_INDICES[nextMonthIndex];
            const nextId = `cell-${nextUnitIndex}-${month}`;
            const element = document.getElementById(nextId);
            if (element) { element.focus(); element.select(); setSelection({ start: { r: nextUnitIndex, c: nextMonthIndex }, end: { r: nextUnitIndex, c: nextMonthIndex }, isDragging: false }); }
        }
    };
    
    const handleFocus = (e, r, c) => { e.target.select(); if (!selection.isDragging) setSelection({ start: { r, c }, end: { r, c }, isDragging: false }); };
    const handleAddYear = () => { const nextYear = availableYears[availableYears.length - 1] + 1; setAvailableYears([...availableYears, nextYear]); setSelectedYear(nextYear); };
    const clearTable = () => { if (window.confirm(`DİKKAT: ${selectedYear} yılı temizlenecek.`)) { const newGrid = {}; UNITS.forEach((unit) => { newGrid[unit] = { 1: "", 2: "", 3: "", 4: "", 5: "", 6: "", 7: "", 8: "", 9: "", 10: "", 11: "", 12: "" }; }); setGridData(newGrid); setPendingChanges(true); } };
    
    const handleSave = () => {
        let updatedData = [...allData];
        UNITS.forEach((unit) => {
          MONTH_INDICES.forEach((month) => {
            const value = gridData[unit][month];
            const cleanValueStr = String(value).trim().replace(",", ".");
            const numValue = cleanValueStr === "" || cleanValueStr === "undefined" ? null : parseFloat(cleanValueStr);
            const existingIndex = updatedData.findIndex((d) => d.unit === unit && d.year === parseInt(selectedYear) && d.month === month);
            const finalValue = numValue === null ? null : selectedMetric.includes("Kargo") ? parseInt(cleanValueStr) : numValue;
            if (existingIndex >= 0) { updatedData[existingIndex] = { ...updatedData[existingIndex], [selectedMetric]: finalValue }; } 
            else if (numValue !== null) {
              const newRecord = { id: `${unit}-${selectedYear}-${month}`, unit: unit, year: parseInt(selectedYear), month: month, teslimPerformansi: "", rotaOrani: "", tvsOrani: "", checkInOrani: "", smsOrani: "", eAtfOrani: "", elektronikIhbar: "", gelenKargo: "", gidenKargo: "", [selectedMetric]: finalValue, };
              updatedData.push(newRecord);
            }
          });
        });
        onSaveBatch(updatedData);
        setPendingChanges(false); // Kayıt başarılı olunca pendingChanges kapat
        alert("Veriler Başarıyla Kaydedildi!");
    };

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
       <div className="bg-slate-900 text-white px-4 py-3 flex flex-wrap items-center justify-between shadow-md gap-2">
         <div className="flex items-center gap-3">
             <Grid className="text-blue-400" size={24} />
             <div>
                 <h2 className="text-lg font-bold">Yıllık Veri Girişi</h2>
                 {pendingChanges && <span className="text-xs bg-yellow-500 text-black px-2 py-0.5 rounded font-bold">Kaydedilmemiş Değişiklikler Var</span>}
             </div>
         </div>
         {/* SADECE KAYDET VE ÇIKIŞ BUTONLARI */}
         <div className="flex flex-wrap gap-2 items-center">
            <button onClick={handleSave} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg text-sm font-bold shadow-lg transition-colors flex items-center gap-2">
                {isSaving ? <RefreshCw className="animate-spin" size={16}/> : <Save size={16}/>} 
                Kaydet
            </button>
            <button onClick={onClose} className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2">
                <LogOut size={16}/> 
                Çıkış
            </button>
         </div>
       </div>
       <div className="bg-slate-100 border-b border-slate-200">
          <div className="p-3 flex gap-3 items-center justify-between border-b border-slate-200">
             <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-md border border-slate-300 shadow-sm">
                <span className="text-xs font-bold text-slate-500 uppercase">Yıl:</span>
                <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className="bg-transparent font-bold text-slate-800 outline-none">{availableYears.map((y) => (<option key={y} value={y}>{y}</option>))}</select>
                <button onClick={handleAddYear} className="ml-2 p-1 bg-slate-200 hover:bg-blue-100 rounded-full"><Plus size={14} /></button>
             </div>
             <button onClick={clearTable} className="flex items-center gap-1 px-3 py-1.5 bg-white text-orange-600 rounded border border-orange-200 text-xs font-bold"><RotateCcw size={14} /> Temizle</button>
          </div>
          <div className="px-2 py-2 flex gap-2 overflow-x-auto no-scrollbar">{METRIC_TYPES.map((metric) => (<button key={metric.id} onClick={() => setSelectedMetric(metric.id)} className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${selectedMetric === metric.id ? `bg-slate-800 text-white shadow-md transform scale-105` : "bg-white text-slate-600 hover:bg-slate-200 border border-slate-200"}`}><Layers size={14} />{metric.label}</button>))}</div>
       </div>
       <div className="flex-1 overflow-auto bg-slate-5 select-none">
          <table className="w-full border-collapse text-sm bg-white">
             <thead className="bg-slate-200 sticky top-0 z-10 shadow-sm"><tr><th className="p-3 text-left font-bold text-slate-700 border-r border-slate-300 w-48 sticky left-0 bg-slate-200 z-20">Birim ({UNITS.length})</th>{MONTH_INDICES.map((month) => (<th key={month} className="p-2 w-24 text-center font-bold text-slate-700 border-r border-slate-300 bg-slate-100">{MONTH_NAMES[month]}</th>))}</tr></thead>
             <tbody>{UNITS.map((unit, unitIndex) => { const data = gridData[unit] || {}; return (<tr key={unit} className="border-b border-slate-200 hover:bg-blue-50 transition-colors group"><td className="p-3 font-semibold text-slate-800 border-r border-slate-200 sticky left-0 bg-white group-hover:bg-blue-50 select-text shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">{unit}</td>{MONTH_INDICES.map((month, monthArrIndex) => { const isSelected = isCellSelected(unitIndex, monthArrIndex); return (<td key={month} className="p-0 border-r border-slate-100 relative"><input id={`cell-${unitIndex}-${month}`} type="text" className={`w-full h-full p-2 text-center outline-none focus:z-10 relative transition-all text-slate-700 font-mono cursor-default ${isSelected ? "bg-blue-200 ring-1 ring-blue-400" : "bg-transparent focus:ring-2 focus:ring-blue-500 focus:bg-white"}`} placeholder="-" value={data[month] ?? ""} onChange={(e) => handleInputChange(unit, month, e.target.value)} onPaste={(e) => handlePaste(e, unitIndex, monthArrIndex)} onKeyDown={(e) => handleKeyDown(e, unitIndex, monthArrIndex)} onFocus={(e) => handleFocus(e, unitIndex, monthArrIndex)} onMouseDown={() => handleMouseDown(unitIndex, monthArrIndex)} onMouseEnter={() => handleMouseEnter(unitIndex, monthArrIndex)} autoComplete="off" /></td>); })}</tr>); })}</tbody>
          </table>
       </div>
    </div>
  );
};

// --- YENİ BİLEŞEN: NOTLAR SAYFASI ---
const NotesPage = ({ user, onClose }) => {
  const [selectedUnit, setSelectedUnit] = useState(UNITS[0]);
  const [noteText, setNoteText] = useState("");
  const [notes, setNotes] = useState([]);
  const [selectedNote, setSelectedNote] = useState(null); 
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "artifacts", appId, "public", "data", "unit_notes"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setNotes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  const handleSaveNote = async () => {
    if (!noteText.trim()) return;
    setLoading(true);
    try {
      await addDoc(collection(db, "artifacts", appId, "public", "data", "unit_notes"), {
        unit: selectedUnit,
        text: noteText,
        author: user.displayName || user.email,
        authorId: user.uid,
        createdAt: serverTimestamp()
      });
      setNoteText("");
      alert("Not başarıyla eklendi.");
    } catch (error) {
      console.error("Error adding note: ", error);
      alert("Not eklenirken hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteNote = async (id) => {
    if(!window.confirm("Bu notu silmek istediğinize emin misiniz?")) return;
    try {
      await deleteDoc(doc(db, "artifacts", appId, "public", "data", "unit_notes", id));
    } catch (error) {
      console.error("Error removing note: ", error);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      <div className="bg-white sticky top-0 z-10 border-b border-slate-200 px-4 py-3 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 -ml-2 hover:bg-slate-100 rounded-full">
            <ArrowLeft size={22} className="text-slate-600" />
          </button>
          <h1 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <FileText className="text-orange-500" /> Birim Notları
          </h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4 space-y-6">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <h2 className="text-sm font-bold text-slate-700 uppercase mb-4 flex items-center gap-2">
            <FilePlus size={16} /> Yeni Not Ekle
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Birim Seçiniz</label>
              <select 
                value={selectedUnit} 
                onChange={(e) => setSelectedUnit(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm font-semibold text-slate-700"
              >
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Not İçeriği</label>
              <textarea 
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Buraya notunuzu yazın..."
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px] text-sm text-slate-700"
              />
            </div>

            <button 
              onClick={handleSaveNote} 
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg text-sm font-bold transition-colors w-full sm:w-auto flex items-center justify-center gap-2"
            >
              {loading ? <RefreshCw className="animate-spin" size={16} /> : <Save size={16} />} 
              Kaydet
            </button>
          </div>
        </div>

        <div className="space-y-3">
           <h3 className="text-sm font-bold text-slate-500 uppercase px-1">Son Eklenen Notlar</h3>
           {notes.length === 0 ? (
             <div className="text-center py-10 text-slate-400 bg-white rounded-xl border border-dashed border-slate-300">
               <MessageSquare size={32} className="mx-auto mb-2 opacity-50" />
               <p>Henüz not eklenmemiş.</p>
             </div>
           ) : (
             notes.map(note => (
               <div key={note.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow relative group">
                 <div className="flex justify-between items-start mb-2">
                   <div>
                     <span className="inline-block bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded mr-2">
                       {note.unit}
                     </span>
                     <span className="text-xs text-slate-400">
                       {formatDate(note.createdAt)}
                     </span>
                   </div>
                   <div className="flex gap-1">
                      <button onClick={() => setSelectedNote(note)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Oku">
                        <Eye size={16} />
                      </button>
                      <button onClick={() => handleDeleteNote(note.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Sil">
                        <Trash2 size={16} />
                      </button>
                   </div>
                 </div>
                 
                 <p className="text-sm text-slate-700 line-clamp-2 cursor-pointer" onClick={() => setSelectedNote(note)}>
                   {note.text}
                 </p>
                 
                 <div className="mt-3 flex items-center gap-2 text-xs text-slate-500 border-t border-slate-100 pt-2">
                   <User size={12} />
                   <span className="font-medium">{note.author}</span>
                 </div>
               </div>
             ))
           )}
        </div>
      </div>

      {selectedNote && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedNote(null)}>
          <div className="bg-white w-full max-w-lg rounded-2xl p-6 shadow-2xl relative" onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelectedNote(null)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
              <X size={20} />
            </button>
            <div className="mb-4">
               <span className="bg-blue-100 text-blue-800 font-bold px-3 py-1 rounded text-sm">{selectedNote.unit}</span>
            </div>
            <div className="max-h-[60vh] overflow-y-auto mb-6">
              <p className="text-slate-800 whitespace-pre-wrap leading-relaxed">
                {selectedNote.text}
              </p>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-400 border-t pt-4">
              <span className="flex items-center gap-1"><User size={14}/> {selectedNote.author}</span>
              <span>{formatDate(selectedNote.createdAt)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- LANDING MENU ---
const LandingMenu = ({ onNavigate, user, onLogout, onProfile }) => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Operasyon Portalı</h1>
          <p className="text-xs text-slate-500">Hoşgeldin, {user.displayName || user.email}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={onProfile} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"><UserCog size={20}/></button>
          <button onClick={onLogout} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"><LogOut size={20}/></button>
        </div>
      </div>
      <div className="flex-1 p-6 flex items-center justify-center">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
           <div onClick={() => onNavigate('admin')} className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 hover:shadow-xl hover:border-blue-300 transition-all cursor-pointer group flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 group-hover:bg-slate-800 transition-colors">
                <Lock size={32} className="text-slate-600 group-hover:text-white" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">Admin Veri Girişi</h3>
              <p className="text-sm text-slate-500">Aylık performans verilerinin girişi.</p>
           </div>
           <div onClick={() => onNavigate('dashboard')} className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 hover:shadow-xl hover:border-blue-300 transition-all cursor-pointer group flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4 group-hover:bg-blue-600 transition-colors">
                <Activity size={32} className="text-blue-600 group-hover:text-white" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">Birimler</h3>
              <p className="text-sm text-slate-500">Birimlerin performans verilerini görmek için.</p>
           </div>
           <div onClick={() => onNavigate('notes')} className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 hover:shadow-xl hover:border-orange-300 transition-all cursor-pointer group flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mb-4 group-hover:bg-orange-500 transition-colors">
                <FileText size={32} className="text-orange-500 group-hover:text-white" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">Birim Notları</h3>
              <p className="text-sm text-slate-500">Birimlerle ilgili notlar ekle ve yönet.</p>
           </div>
        </div>
      </div>
      <div className="text-center py-4 text-xs text-slate-400">v1.2.0 - Güvenli Sistem</div>
    </div>
  );
};

// --- USER PROFILE MODAL ---
const UserProfileModal = ({ user, onClose }) => {
  const [displayName, setDisplayName] = useState(user.displayName || "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  const handleUpdateProfile = async (e) => {
    e.preventDefault(); setIsLoading(true); setMessage({ type: "", text: "" });
    try {
      if (displayName !== user.displayName) { await updateProfile(user, { displayName: displayName }); }
      if (newPassword) {
        if (newPassword.length < 6) throw new Error("Şifre en az 6 karakter olmalıdır.");
        if (newPassword !== confirmPassword) throw new Error("Şifreler uyuşmuyor.");
        await updatePassword(user, newPassword);
      }
      setMessage({ type: "success", text: "Profil güncellendi!" }); setNewPassword(""); setConfirmPassword("");
    } catch (error) {
      console.error(error);
      let errText = error.code === "auth/requires-recent-login" ? "Güvenlik gereği tekrar giriş yapmalısınız." : error.message;
      setMessage({ type: "error", text: errText });
    } finally { setIsLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div className="bg-white p-6 rounded-xl w-full max-w-md shadow-2xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X size={20} /></button>
        <h3 className="text-lg font-bold mb-6 flex items-center gap-2"><UserCog className="text-blue-600" /> Profil Ayarları</h3>
        {message.text && <div className={`mb-4 p-3 rounded-lg text-sm ${message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>{message.text}</div>}
        <form onSubmit={handleUpdateProfile} className="space-y-4">
          <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Ad Soyad</label><input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" /></div>
          <div className="border-t border-slate-100 my-4 pt-4"><h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2"><Key size={14} /> Şifre Değiştir</h4><div className="space-y-3"><input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none" placeholder="Yeni Şifre" /><input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none" placeholder="Yeni Şifre (Tekrar)" /></div></div>
          <button type="submit" disabled={isLoading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-lg transition-all flex justify-center items-center gap-2">{isLoading ? <RefreshCw size={16} className="animate-spin" /> : "Kaydet"}</button>
        </form>
      </div>
    </div>
  );
};

// --- LOGIN SCREEN ---
const LoginScreen = ({ onLogin, loading, error }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const handleSubmit = (e) => { e.preventDefault(); onLogin(email, password); };
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-blue-600 p-8 text-center"><div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm"><Box className="text-white" size={32} /></div><h1 className="text-2xl font-bold text-white mb-2">Performans Takip</h1><p className="text-blue-100 text-sm">Yetkili Personel Girişi</p></div>
        <form onSubmit={handleSubmit} className="p-8 pt-10">
          {error && <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg flex items-center gap-2"><AlertCircle size={16} />{error}</div>}
          <div className="space-y-4"><div><label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">E-Posta</label><div className="relative"><User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" /></div></div><div><label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Şifre</label><div className="relative"><Key className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" /></div></div></div>
          <button type="submit" disabled={loading} className="w-full mt-8 bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-xl flex justify-center items-center gap-2">{loading ? "Giriş..." : "Sisteme Giriş Yap"}</button>
        </form>
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
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [availableYears, setAvailableYears] = useState([2024, 2025, 2026]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);

  const [isAdminOpen, setAdminOpen] = useState(false);
  const [isProfileOpen, setProfileOpen] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [password, setPassword] = useState("");

  useEffect(() => { const unsubscribe = onAuthStateChanged(auth, (u) => { setUser(u); setAuthLoading(false); }); return () => unsubscribe(); }, []);

  const handleAppLogin = async (email, password) => {
    setLoginLoading(true); setLoginError("");
    try { await signInWithEmailAndPassword(auth, email, password); setView("menu"); } 
    catch (e) { setLoginError("Hatalı giriş."); } finally { setLoginLoading(false); }
  };
  const handleAppLogout = async () => { if(window.confirm("Çıkış?")) { await signOut(auth); setView("menu"); } };

  useEffect(() => {
    if (!user) { setAllData([]); return; }
    const unsubscribe = onSnapshot(collection(db, "artifacts", appId, "public", "data", "performance_records"), (snap) => setAllData(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => unsubscribe();
  }, [user]);

  const uniqueUnits = useMemo(() => UNITS, []);
  const filteredUnits = uniqueUnits.filter((unit) => unit.toLowerCase().includes(searchQuery.toLowerCase()));
  const currentData = useMemo(() => {
    if (!selectedUnit) return null;
    return allData.find(d => d.unit === selectedUnit && d.year === parseInt(selectedYear) && d.month === parseInt(selectedMonth));
  }, [allData, selectedUnit, selectedYear, selectedMonth]);

  const handleUnitClick = (unit) => {
    setSelectedUnit(unit);
    const unitData = allData.filter((d) => d.unit === unit);
    if (unitData.length > 0) {
      const latestData = unitData.sort((a, b) => b.year - a.year || b.month - a.month)[0];
      if (latestData) { setSelectedYear(latestData.year); setSelectedMonth(latestData.month); }
    }
    setView("detail"); window.scrollTo(0, 0);
  };

  const handleNavigateFromMenu = (target) => {
      if (target === 'admin') { setShowLoginModal(true); } 
      else if (target === 'dashboard') { setView('dashboard'); }
      else if (target === 'notes') { setView('notes'); }
  };

  const handleLoginForAdmin = () => {
    if (password === "Marvel3535") { setShowLoginModal(false); setAdminOpen(true); setPassword(""); } 
    else { alert("Hatalı şifre!"); }
  };

  const handleSaveBatch = async (records) => {
    setIsSaving(true);
    try {
        const promises = records.map(r => setDoc(doc(db, "artifacts", appId, "public", "data", "performance_records", r.id), JSON.parse(JSON.stringify(r)), { merge: true }));
        await Promise.all(promises);
    } catch(e){console.error(e)} finally{setIsSaving(false)}
  };
  
  const handleResetAll = () => alert("Devre dışı.");

  const renderDashboard = () => (
    <div className="pb-24">
      <div className="sticky top-0 bg-white/95 backdrop-blur-md z-10 border-b border-slate-100 px-4 py-3 shadow-sm">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-3">
             <button onClick={() => setView('menu')} className="p-2 -ml-2 hover:bg-slate-100 rounded-full text-slate-500"><Home size={22} /></button>
             <h1 className="text-xl font-bold text-slate-900 tracking-tight">Birimler</h1>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
          <input type="text" placeholder="Hızlı ara..." className="w-full pl-10 pr-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
      </div>
      <div className="px-4 mt-2">
        {filteredUnits.map((unit, index) => (
          <div key={index} onClick={() => handleUnitClick(unit)} className="group flex items-center justify-between p-4 mb-2 bg-white rounded-xl border border-slate-100 shadow-sm active:scale-[0.98] transition-all cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-blue-200 shadow-md">{unit.charAt(0)}</div>
              <div><span className="font-semibold text-slate-800 block">{unit}</span><span className="text-xs text-slate-400">Detayları görüntüle</span></div>
            </div>
            <ChevronRight className="text-slate-300 group-hover:text-blue-500 transition-colors" size={20} />
          </div>
        ))}
      </div>
    </div>
  );

  const renderDetail = () => {
    const isTeslimBasarisiz = currentData && parseFloat(currentData.teslimPerformansi) < 94;
    return (
        <div className="pb-24 bg-slate-50 min-h-screen">
           <div className="bg-white sticky top-0 z-20 shadow-sm border-b border-slate-100">
             <div className="px-4 py-3 flex items-center gap-3">
               <button onClick={() => setView("dashboard")} className="p-2 -ml-2 hover:bg-slate-100 rounded-full"><ArrowLeft size={22} className="text-slate-600" /></button>
               <div><h1 className="text-lg font-bold text-slate-800 leading-tight">{selectedUnit}</h1><div className="flex items-center gap-1 text-xs text-slate-500"><Calendar size={10} /> <span>{selectedYear} Dönemi</span></div></div>
             </div>
             <div className="pl-4 pb-3 flex gap-2 overflow-x-auto no-scrollbar snap-x">
                <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} className="bg-slate-100 text-slate-800 font-bold text-sm py-1.5 px-3 rounded-lg border-none focus:ring-0 shrink-0">{availableYears.map((y) => <option key={y} value={y}>{y}</option>)}</select>
                <div className="w-[1px] h-8 bg-slate-200 shrink-0 mx-1"></div>
                {MONTH_NAMES.map((m, i) => { if (i === 0) return null; return (<button key={i} onClick={() => setSelectedMonth(i)} className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all snap-center ${i === selectedMonth ? "bg-slate-800 text-white shadow-md" : "bg-white border border-slate-200 text-slate-500"}`}>{m}</button>); })}
            </div>
           </div>
           <div className="p-4 space-y-4">
               {currentData ? (
                  <>
                    <div className={`rounded-2xl p-5 text-white shadow-lg mb-2 relative overflow-hidden ${isTeslimBasarisiz ? "bg-gradient-to-br from-red-600 to-rose-700 shadow-red-200" : "bg-gradient-to-br from-indigo-600 to-blue-700 shadow-indigo-200"}`}>
                        <div className="relative z-10"><p className={`text-xs font-medium uppercase tracking-wider opacity-80 ${isTeslimBasarisiz ? "text-red-100" : "text-indigo-100"}`}>Teslim Performansı</p><div className="flex items-end gap-2 mt-1"><h2 className="text-4xl font-bold">{formatNumber(currentData.teslimPerformansi)}%</h2><p className={`mb-1.5 text-sm ${isTeslimBasarisiz ? "text-red-100" : "text-indigo-200"}`}>Hedef: %94</p></div></div>
                    </div>
                    <div><h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 pl-1">Rotalama Verileri</h3><div className="grid grid-cols-3 gap-2"><KPICard title="Rota" value={currentData.rotaOrani} suffix="%" color={currentData.rotaOrani <= 80 ? "red" : "emerald"} icon={TrendingUp} /><KPICard title="TVS" value={currentData.tvsOrani} suffix="%" color={currentData.tvsOrani <= 90 ? "red" : "emerald"} icon={Activity} /><KPICard title="Check-in" value={currentData.checkInOrani} suffix="%" color={currentData.checkInOrani <= 90 ? "red" : "emerald"} icon={CheckCircle2} /></div></div>
                    <div><h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 pl-1">Operasyonel Veriler</h3><div className="grid grid-cols-3 gap-2"><KPICard title="SMS" value={currentData.smsOrani} suffix="%" color={currentData.smsOrani <= 50 ? "red" : "blue"} icon={Smartphone} /><KPICard title="E-ATF" value={currentData.eAtfOrani} suffix="%" color={currentData.eAtfOrani <= 80 ? "red" : "blue"} icon={FileText} /><KPICard title="E-İhbar" value={currentData.elektronikIhbar} suffix="%" color={currentData.elektronikIhbar <= 90 ? "red" : "blue"} icon={Mail} /></div></div>
                    <div><h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 pl-1">Gelen-Giden Belge Sayıları</h3><div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex justify-between items-center gap-4"><div className="flex-1 text-center border-r border-slate-100 flex flex-col items-center"><Truck size={20} className="text-slate-300 mb-1" /><p className="text-xs text-slate-400 mb-1">Gelen</p><p className="text-xl font-bold text-slate-800">{currentData.gelenKargo}</p></div><div className="flex-1 text-center flex flex-col items-center"><Box size={20} className="text-slate-300 mb-1" /><p className="text-xs text-slate-400 mb-1">Giden</p><p className="text-xl font-bold text-slate-800">{currentData.gidenKargo}</p></div></div></div>
                  </>
               ) : (
                 <div className="flex flex-col items-center justify-center py-20 text-slate-400"><Box size={48} className="mb-4 opacity-20" /><p className="text-sm">Veri yok.</p></div>
               )}
           </div>
        </div>
    );
  };

  if (authLoading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><RefreshCw className="animate-spin text-slate-400" size={32} /></div>;
  if (!user) return <LoginScreen onLogin={handleAppLogin} loading={loginLoading} error={loginError} />;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 safe-area-pb">
      {view === 'menu' && <LandingMenu user={user} onNavigate={handleNavigateFromMenu} onLogout={handleAppLogout} onProfile={() => setProfileOpen(true)} />}
      {view === 'dashboard' && renderDashboard()}
      {view === 'detail' && renderDetail()}
      {view === 'notes' && <NotesPage user={user} onClose={() => setView('menu')} />}
      {isAdminOpen && <AdminPanel allData={allData} onSaveBatch={handleSaveBatch} onClose={() => { setAdminOpen(false); setView('menu'); }} onResetAll={handleResetAll} availableYears={availableYears} setAvailableYears={setAvailableYears} isSaving={isSaving} />}
      {isProfileOpen && <UserProfileModal user={user} onClose={() => setProfileOpen(false)} />}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white p-6 rounded-xl w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Lock className="text-slate-800" /> Admin Yetkisi</h3>
            <p className="text-sm text-slate-500 mb-4">Veri girişi paneline erişmek için şifre giriniz.</p>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full border p-3 rounded-lg mb-4 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Şifre" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowLoginModal(false)} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-lg">İptal</button>
              <button onClick={handleLoginForAdmin} className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700">Giriş Yap</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
