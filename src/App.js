import React, { useState, useEffect } from "react";
import {
  Search,
  Book,
  Layers,
  MessageSquare,
  AlertCircle,
  Sparkles,
  Database,
  Globe,
  Cpu,
  X,
} from "lucide-react";
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";

// ==========================================
// 1. YAPAY ZEKA (GEMINI) ANAHTARI
// ==========================================
const geminiApiKey = "AIzaSyBhH9dJ55Qg5BCF2Kv7sGSdvlci5w-v7Jw";

// ==========================================
// 2. FIREBASE AYARLARI
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyAeBBWnSENJtqZrySuT5K5TKyQaypVx_Sk",
  authDomain: "yapayzekasozluk-2b59a.firebaseapp.com",
  projectId: "yapayzekasozluk-2b59a",
  storageBucket: "yapayzekasozluk-2b59a.firebasestorage.app",
  messagingSenderId: "167803887390",
  appId: "1:167803887390:web:32306d0fe5b1bb1947330f",
  measurementId: "G-JJ3RNEXG37",
};

// Firebase Başlatma
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = "yapayzekasozluk-v3"; // Sabit App ID

// --- KELİME KÖKÜ MANTIĞI (YARDIMCI LİSTE) ---
const wordMappings = {
  sat: "sit",
  sitting: "sit",
  sits: "sit",
  went: "go",
  gone: "go",
  going: "go",
  goes: "go",
  ate: "eat",
  eaten: "eat",
  took: "take",
  taken: "take",
  wrote: "write",
  written: "write",
  better: "good",
  best: "good",
  mice: "mouse",
  feet: "foot",
  children: "child",
  bought: "buy",
  flies: "fly",
  flew: "fly",
  flown: "fly",
  ran: "run",
  running: "run",
  saw: "see",
  seen: "see",
  seeing: "see",
  happier: "happy",
  happiest: "happy",
};

export default function App() {
  const [user, setUser] = useState(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [rootWord, setRootWord] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [source, setSource] = useState(null);

  // Otomatik Giriş (Firebase Auth)
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Anonim giriş yapmayı dener
        await signInAnonymously(auth);
      } catch (err) {
        console.warn("Firebase Auth Hatası:", err);
        // Hata olsa bile uygulamayı kilitleme, sadece logla.
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // --- AI FONKSİYONU (GÜVENLİ VE TEMİZLENMİŞ) ---
  const fetchFromAI = async (word) => {
    // Anahtar kontrolü
    if (!geminiApiKey || geminiApiKey.includes("BURAYA")) {
      throw new Error(
        "Lütfen kodun en üstündeki 'geminiApiKey' alanına yapay zeka anahtarını yapıştırın."
      );
    }

    setAiLoading(true);
    try {
      const prompt = `
        You are an English-Turkish dictionary API.
        Word: "${word}"

        Task:
        1. Identify the ROOT form (e.g. "went" -> "go").
        2. Provide definitions for the ROOT word.
        
        IMPORTANT:
        - Provide ONLY raw JSON output.
        - Do NOT use Markdown (no \`\`\`json tags).
        
        Output strict JSON format:
        {
          "root": "string (root word)",
          "definitions": [
            {
              "type": "noun/verb/adj",
              "meaning": "Turkish meaning",
              "english_definition": "Simple English definition",
              "example": "English example sentence",
              "tags": ["tag1", "tag2"],
              "v2": "past tense (if verb)",
              "v3": "participle (if verb)",
              "plural": "plural form (if noun)",
              "comparative": "comp form (if adj)"
            }
          ]
        }
      `;

      // GÜNCELLEME: Model ismi 'gemini-2.5-flash-preview-09-2025' olarak değiştirildi.
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${geminiApiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: "application/json", // JSON zorlaması
            },
          }),
        }
      );

      if (!response.ok) {
        const errDetail = await response.text();
        console.error("API Error Details:", errDetail);
        throw new Error(`API Hatası: ${response.statusText}`);
      }

      const data = await response.json();
      let aiText = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!aiText) throw new Error("AI boş yanıt döndürdü.");

      // --- TEMİZLİK KISMI (HATA ÇÖZÜMÜ) ---
      // Gelen yanıttaki ```json ve ``` işaretlerini siler
      aiText = aiText
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

      let parsedData;
      try {
        parsedData = JSON.parse(aiText);
      } catch (e) {
        console.error("JSON Parse Hatası. Gelen veri:", aiText);
        throw new Error("AI geçersiz formatta yanıt verdi, tekrar deneyin.");
      }

      const definitions = parsedData.definitions || [];
      const root = parsedData.root || word;

      // Veritabanına Kaydet (Public Data)
      if (user && definitions.length > 0) {
        try {
          const rootKey = root.toLowerCase().trim();
          // Firestore yolunu senin proje ayarlarına uygun hale getirdik
          const docRef = doc(
            db,
            "artifacts",
            appId,
            "public",
            "data",
            "dictionary_" + rootKey
          );
          await setDoc(docRef, {
            definitions: definitions,
            root: root,
            createdAt: new Date().toISOString(),
          });
        } catch (e) {
          console.warn(
            "DB Kayıt uyarısı (Önemli değil, izinleri kontrol et):",
            e
          );
        }
      }

      return { definitions, root };
    } catch (err) {
      console.error("AI Error Full:", err);
      throw err;
    } finally {
      setAiLoading(false);
    }
  };

  const handleSearch = async (e) => {
    e?.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setResults(null);
    setRootWord(null);
    setSource(null);

    const lowerQuery = query.toLowerCase().trim();
    let searchKey = lowerQuery;
    let detectedRoot = null;

    // 1. Manuel Liste Kontrolü
    if (wordMappings[lowerQuery]) {
      searchKey = wordMappings[lowerQuery];
      detectedRoot = searchKey;
    }

    try {
      // 2. Veritabanı Kontrolü
      let docSnap = null;
      try {
        const docRef = doc(
          db,
          "artifacts",
          appId,
          "public",
          "data",
          "dictionary_" + searchKey
        );
        docSnap = await getDoc(docRef);
      } catch (dbErr) {
        console.log("DB okuma atlandı:", dbErr);
      }

      if (docSnap && docSnap.exists()) {
        const data = docSnap.data();
        setResults(data.definitions);
        setSource("db");
        if (!detectedRoot && data.root && data.root !== lowerQuery) {
          setRootWord(data.root);
        } else if (detectedRoot) {
          setRootWord(detectedRoot);
        }
      } else {
        // 3. Yapay Zeka (Gemini) Çağrısı
        const aiResult = await fetchFromAI(searchKey);
        setResults(aiResult.definitions);
        setSource("ai");
        if (aiResult.root && aiResult.root.toLowerCase() !== lowerQuery) {
          setRootWord(aiResult.root.toLowerCase());
        }
      }
    } catch (err) {
      setError(err.message || "Beklenmedik bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  const clearSearch = () => {
    setQuery("");
    setResults(null);
    setRootWord(null);
    setSource(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-gray-800 flex flex-col">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-20 border-b border-gray-200">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between max-w-3xl">
          <div className="flex items-center gap-2 text-indigo-600">
            <div className="bg-indigo-600 text-white p-1.5 rounded-lg">
              <Book className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-gray-900">
              AI Sözlük
            </h1>
          </div>
          <div className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-1 rounded-full flex items-center gap-1">
            <Cpu size={12} /> v3.2 (Fixed)
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow container mx-auto px-4 py-6 max-w-3xl w-full">
        {/* Anahtar Uyarısı (Eğer Gemini Key Girilmemişse Görünür) */}
        {geminiApiKey.includes("BURAYA") && (
          <div className="mb-6 bg-yellow-50 border border-yellow-200 p-4 rounded-xl text-yellow-800 text-sm flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p>
              <strong>Dikkat:</strong> Veritabanı bağlantısı tamam ancak{" "}
              <b>Gemini API Anahtarı</b> eksik. Lütfen kodun 30. satırına API
              anahtarını yapıştırın.
            </p>
          </div>
        )}

        {/* Search Section */}
        <div className="relative mb-8 group">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <form onSubmit={handleSearch}>
            <input
              type="text"
              placeholder="Kelime ara (örn: running, book)..."
              className="w-full pl-12 pr-12 py-4 bg-white border border-gray-200 rounded-2xl shadow-sm text-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder-gray-400 appearance-none"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute right-14 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
              >
                <X size={18} />
              </button>
            )}
            <button
              type="submit"
              disabled={!query.trim() || loading}
              className="absolute right-2 top-2 bottom-2 bg-indigo-600 text-white rounded-xl px-4 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white" />
              ) : (
                "Ara"
              )}
            </button>
          </form>
        </div>

        {/* Örnekler */}
        {!results && !loading && (
          <div className="mt-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-1">
              Örnek Aramalar
            </p>
            <div className="flex flex-wrap gap-2">
              {["serendipity", "obfuscate", "running", "better"].map((w) => (
                <button
                  key={w}
                  onClick={() => setQuery(w)}
                  className="px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-full text-sm font-medium hover:bg-gray-50 hover:border-indigo-200 hover:text-indigo-600 transition-all active:scale-95"
                >
                  {w}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Yükleniyor */}
        {aiLoading && (
          <div className="flex flex-col items-center justify-center py-12 text-center space-y-4 animate-fade-in">
            <div className="relative">
              <div className="w-12 h-12 border-4 border-indigo-100 rounded-full animate-spin border-t-indigo-600"></div>
              <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-600 w-5 h-5" />
            </div>
            <p className="text-gray-500 font-medium animate-pulse">
              Yapay zeka anlamını çözüyor...
            </p>
          </div>
        )}

        {/* Hata */}
        {!loading && error && (
          <div className="bg-red-50 border border-red-200 p-4 rounded-2xl flex items-start gap-3 animate-slide-up">
            <AlertCircle className="text-red-500 w-6 h-6 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-red-800 text-sm">Hata Oluştu</h3>
              <p className="text-red-600 text-sm mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Sonuçlar */}
        {!loading && results && (
          <div className="space-y-6 animate-slide-up">
            <div className="flex items-center justify-between bg-white px-4 py-3 rounded-xl border border-gray-200 shadow-sm">
              <div className="flex items-center gap-3">
                <div
                  className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-md ${
                    source === "ai"
                      ? "bg-purple-100 text-purple-700"
                      : "bg-green-100 text-green-700"
                  }`}
                >
                  {source === "ai" ? (
                    <Sparkles size={12} />
                  ) : (
                    <Database size={12} />
                  )}
                  {source === "ai" ? "AI Üretti" : "Veritabanı"}
                </div>
                {rootWord && (
                  <div className="flex items-center gap-1 text-sm text-gray-500">
                    <span className="text-gray-400 line-through decoration-red-400 decoration-2">
                      {query}
                    </span>
                    <span>→</span>
                    <span className="font-bold text-gray-800 bg-yellow-100 px-1 rounded">
                      {rootWord}
                    </span>
                  </div>
                )}
              </div>
            </div>
            {results.map((item, index) => (
              <DefinitionCard key={index} item={item} index={index + 1} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function DefinitionCard({ item, index }) {
  const typeColors = {
    verb: "bg-green-50/50 border-green-200 text-green-800",
    noun: "bg-blue-50/50 border-blue-200 text-blue-800",
    adjective: "bg-purple-50/50 border-purple-200 text-purple-800",
    default: "bg-gray-50/50 border-gray-200 text-gray-800",
  };
  const badgeColors = {
    verb: "bg-green-100 text-green-700",
    noun: "bg-blue-100 text-blue-700",
    adjective: "bg-purple-100 text-purple-700",
    default: "bg-gray-100 text-gray-700",
  };
  const style = typeColors[item.type] || typeColors.default;
  const badgeStyle = badgeColors[item.type] || badgeColors.default;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-all duration-300">
      <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-start">
        <div className="flex gap-3 items-center">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-gray-500 text-xs font-bold font-mono">
            {index}
          </span>
          <span
            className={`px-2.5 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider ${badgeStyle}`}
          >
            {item.type}
          </span>
        </div>
        <div className="flex gap-1">
          {item.tags?.slice(0, 2).map((tag, i) => (
            <span
              key={i}
              className="text-[10px] font-medium text-gray-400 bg-gray-50 border border-gray-100 px-2 py-1 rounded-full"
            >
              #{tag}
            </span>
          ))}
        </div>
      </div>
      <div className="p-5">
        <div className="space-y-3 mb-6">
          <h3 className="text-2xl font-bold text-gray-900 leading-tight">
            {item.meaning}
          </h3>
          {item.english_definition && (
            <div className="flex gap-3 items-start">
              <Globe className="w-4 h-4 text-indigo-400 mt-1 flex-shrink-0" />
              <p className="text-gray-600 italic leading-relaxed text-sm md:text-base font-serif">
                {item.english_definition}
              </p>
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 gap-3">
          {(item.v2 || item.plural || item.comparative) && (
            <div className={`p-3 rounded-xl text-sm border ${style}`}>
              <div className="flex items-center gap-2 mb-2 font-semibold opacity-80">
                <Layers size={14} />
                {item.type === "verb"
                  ? "Çekimler"
                  : item.type === "noun"
                  ? "Haller"
                  : "Dereceler"}
              </div>
              <div className="grid grid-cols-2 gap-y-1 gap-x-4">
                {item.v2 && (
                  <div className="flex justify-between">
                    <span>Past:</span> <b>{item.v2}</b>
                  </div>
                )}
                {item.v3 && (
                  <div className="flex justify-between">
                    <span>Participle:</span> <b>{item.v3}</b>
                  </div>
                )}
                {item.plural && (
                  <div className="flex justify-between">
                    <span>Plural:</span> <b>{item.plural}</b>
                  </div>
                )}
                {item.comparative && (
                  <div className="flex justify-between">
                    <span>Comp:</span> <b>{item.comparative}</b>
                  </div>
                )}
              </div>
            </div>
          )}
          {item.example && (
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <div className="flex items-center gap-2 mb-1 text-slate-400 text-xs font-bold uppercase tracking-wider">
                <MessageSquare size={12} /> Örnek
              </div>
              <p className="text-slate-700 text-sm font-medium">
                "{item.example}"
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
