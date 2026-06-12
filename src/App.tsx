import React, { useState, useEffect, useRef } from "react";
import { 
  Plus, 
  Receipt, 
  FileText, 
  Upload, 
  Search, 
  Euro, 
  Hash, 
  Package,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  Check,
  X
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Purchase {
  id: number;
  item: string;
  amount: number;
  order_number: string;
  invoice_filename: string | null;
  is_done: number;
  download_count?: number;
  created_at: string;
}

export default function App() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchAmount, setSearchAmount] = useState("");
  
  // Deletion state: null | { id: number, stage: 1 | 2 }
  const [deleting, setDeleting] = useState<{ id: number, stage: number } | null>(null);

  // Add invoice later state
  const [activeUploadId, setActiveUploadId] = useState<number | null>(null);
  const itemFileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [item, setItem] = useState("");
  const [amount, setAmount] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchPurchases();
  }, []);

  const fetchPurchases = async () => {
    try {
      const response = await fetch("/api/purchases");
      if (!response.ok) throw new Error("Fehler beim Laden");
      const data = await response.json();
      setPurchases(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleDone = async (id: number, currentStatus: number) => {
    try {
      const response = await fetch(`/api/purchases/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_done: currentStatus === 1 ? 0 : 1 }),
      });
      if (!response.ok) throw new Error("Fehler beim Aktualisieren");
      fetchPurchases();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: number) => {
    console.log(`Frontend: Löschvorgang für ID ${id} gestartet`);
    try {
      const response = await fetch(`/api/purchases/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Fehler beim Löschen");
      }
      console.log(`Frontend: ID ${id} erfolgreich gelöscht`);
      setDeleting(null);
      fetchPurchases();
    } catch (err) {
      console.error("Frontend Fehler beim Löschen:", err);
      setError("Löschen fehlgeschlagen: " + (err instanceof Error ? err.message : "Unbekannter Fehler"));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);

    if (!item || !amount) {
      setError("Bitte füllen Sie alle Pflichtfelder aus.");
      setSubmitting(false);
      return;
    }

    const formData = new FormData();
    formData.append("item", item);
    formData.append("amount", amount);
    formData.append("order_number", orderNumber);
    if (file) {
      formData.append("invoice", file);
    }

    try {
      const response = await fetch("/api/purchases", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Fehler beim Speichern");

      setSuccess("Einkauf erfolgreich dokumentiert!");
      setItem("");
      setAmount("");
      setOrderNumber("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      
      fetchPurchases();
    } catch (err) {
      setError("Fehler beim Speichern des Einkaufs.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleItemFileClick = (id: number) => {
    setActiveUploadId(id);
    if (itemFileInputRef.current) {
      itemFileInputRef.current.value = "";
      itemFileInputRef.current.click();
    }
  };

  const handleItemFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && activeUploadId !== null) {
      const selectedFile = e.target.files[0];
      const targetId = activeUploadId;
      
      // Reset state early
      setActiveUploadId(null);
      
      const formData = new FormData();
      formData.append("invoice", selectedFile);
      
      setSubmitting(true);
      setError(null);
      setSuccess(null);
      
      try {
        const response = await fetch(`/api/purchases/${targetId}/invoice`, {
          method: "POST",
          body: formData,
        });
        
        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || "Unerwarteter Fehler");
        }
        
        setSuccess("Rechnung wurde erfolgreich hinzugefügt!");
        fetchPurchases();
      } catch (err: any) {
        console.error(err);
        setError("Fehler beim Hochladen der Rechnung: " + err.message);
      } finally {
        setSubmitting(false);
      }
    }
  };

  const filteredPurchases = purchases.filter((p) => {
    if (!searchAmount) return true;
    // Match exact amount or partial string match of the amount
    return p.amount.toString().includes(searchAmount.replace(',', '.'));
  });

  return (
    <div className="min-h-screen bg-[#F5F5F0] text-[#141414] font-sans">
      {/* Header */}
      <header className="bg-white border-b border-[#141414]/10 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-[#0070BA] p-2 rounded-lg">
              <Receipt className="text-white w-6 h-6" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">PayPal Beleg-Manager</h1>
          </div>
          <div className="text-xs font-mono opacity-50 uppercase tracking-widest">
            {new Date().toLocaleDateString('de-DE')}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        {/* Form Section */}
        <section className="lg:col-span-5">
          <div className="bg-white rounded-2xl border border-[#141414]/5 shadow-sm p-8">
            <div className="flex items-center gap-2 mb-6">
              <Plus className="w-5 h-5 text-[#0070BA]" />
              <h2 className="text-lg font-medium">Neuer Einkauf</h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#141414]/50 mb-2">
                  Was wurde gekauft? *
                </label>
                <div className="relative">
                  <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#141414]/30" />
                  <input
                    type="text"
                    value={item}
                    onChange={(e) => setItem(e.target.value)}
                    placeholder="z.B. Monitor, Software-Abo..."
                    className="w-full pl-10 pr-4 py-3 bg-[#F5F5F0] border-none rounded-xl focus:ring-2 focus:ring-[#0070BA]/20 transition-all outline-none"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#141414]/50 mb-2">
                    Betrag (€) *
                  </label>
                  <div className="relative">
                    <Euro className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#141414]/30" />
                    <input
                      type="number"
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-10 pr-4 py-3 bg-[#F5F5F0] border-none rounded-xl focus:ring-2 focus:ring-[#0070BA]/20 transition-all outline-none"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#141414]/50 mb-2">
                    Auftragsnummer
                  </label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#141414]/30" />
                    <input
                      type="text"
                      value={orderNumber}
                      onChange={(e) => setOrderNumber(e.target.value)}
                      placeholder="Optional"
                      className="w-full pl-10 pr-4 py-3 bg-[#F5F5F0] border-none rounded-xl focus:ring-2 focus:ring-[#0070BA]/20 transition-all outline-none"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#141414]/50 mb-2">
                  Rechnung hochladen
                </label>
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    "border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all",
                    file ? "border-[#0070BA] bg-[#0070BA]/5" : "border-[#141414]/10 hover:border-[#141414]/20 bg-[#F5F5F0]/50"
                  )}
                >
                  <Upload className={cn("w-8 h-8 mb-2", file ? "text-[#0070BA]" : "text-[#141414]/30")} />
                  <span className="text-sm font-medium">
                    {file ? file.name : "Datei auswählen oder herziehen"}
                  </span>
                  <span className="text-xs opacity-50 mt-1">PDF, JPG, PNG</span>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    accept=".pdf,.jpg,.jpeg,.png"
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg text-sm">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}

              {success && (
                <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 p-3 rounded-lg text-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  {success}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-[#0070BA] hover:bg-[#005ea6] text-white font-semibold py-4 rounded-xl shadow-lg shadow-[#0070BA]/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Plus className="w-5 h-5" />
                    Einkauf speichern
                  </>
                )}
              </button>
            </form>
          </div>
        </section>

        {/* List Section */}
        <section className="lg:col-span-7 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-lg font-medium flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#141414]/50" />
              Letzte Einkäufe
            </h2>
            
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#141414]/30" />
              <input
                type="text"
                value={searchAmount}
                onChange={(e) => setSearchAmount(e.target.value)}
                placeholder="Betrag suchen..."
                className="w-full pl-10 pr-4 py-2 bg-white border border-[#141414]/10 rounded-xl text-sm focus:ring-2 focus:ring-[#0070BA]/20 transition-all outline-none"
              />
            </div>

            <div className="text-sm text-[#141414]/40 whitespace-nowrap">
              {filteredPurchases.length} von {purchases.length}
            </div>
          </div>

          <div className="space-y-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 opacity-20">
                <Loader2 className="w-10 h-10 animate-spin mb-4" />
                <p>Lade Daten...</p>
              </div>
            ) : filteredPurchases.length === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-[#141414]/10 p-20 text-center">
                <Search className="w-12 h-12 mx-auto mb-4 text-[#141414]/10" />
                <p className="text-[#141414]/40 font-medium">Keine passenden Einkäufe gefunden.</p>
              </div>
            ) : (
              filteredPurchases.map((p) => (
                <div 
                  key={p.id}
                  className={cn(
                    "bg-white rounded-2xl border border-[#141414]/5 p-5 flex items-center justify-between hover:shadow-md transition-all group relative overflow-hidden",
                    p.is_done === 1 && "opacity-60 grayscale-[0.5]"
                  )}
                >
                  {/* Done Overlay Line */}
                  {p.is_done === 1 && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-[1px] bg-[#141414]/20 z-0" />
                  )}

                  <div className="flex items-center gap-4 relative z-10">
                    <button 
                      onClick={() => handleToggleDone(p.id, p.is_done)}
                      className={cn(
                        "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                        p.is_done === 1 
                          ? "bg-emerald-500 border-emerald-500 text-white" 
                          : "border-[#141414]/10 hover:border-[#0070BA]"
                      )}
                    >
                      {p.is_done === 1 && <Check className="w-4 h-4" />}
                    </button>

                    <div className="w-12 h-12 bg-[#F5F5F0] rounded-xl flex items-center justify-center text-[#0070BA]">
                      <Package className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className={cn("font-semibold text-base", p.is_done === 1 && "line-through text-[#141414]/40")}>
                        {p.item}
                      </h3>
                      <div className="flex flex-wrap items-center gap-3 mt-1.5">
                        <span className="text-xs font-mono text-[#141414]/40 bg-[#F5F5F0] px-2 py-0.5 rounded">
                          {p.order_number || "Keine Nr."}
                        </span>
                        <span className="text-xs text-[#141414]/30">
                          {new Date(p.created_at).toLocaleDateString('de-DE')}
                        </span>
                        {p.invoice_filename ? (
                          (p.download_count || 0) > 0 ? (
                            <span className="text-[10px] uppercase font-bold text-emerald-700 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                              <Check className="w-3 h-3" />
                              Eingereicht ({p.download_count}x)
                            </span>
                          ) : (
                            <span className="text-[10px] uppercase font-bold text-amber-700 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                              Bereit / Offen
                            </span>
                          )
                        ) : (
                          <span className="text-[10px] uppercase font-bold text-red-600 bg-red-500/10 border border-red-500/10 px-2 py-0.5 rounded-full">
                            Kein Beleg
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 relative z-10">
                    <div className="text-right mr-2">
                      <div className={cn("text-lg font-bold text-[#141414]", p.is_done === 1 && "text-[#141414]/40")}>
                        {p.amount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {p.invoice_filename ? (
                        <div className="flex items-center gap-1 bg-[#0070BA]/5 p-0.5 rounded-lg">
                          <a 
                            href={`/api/purchases/${p.id}/download`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => {
                              setTimeout(fetchPurchases, 1000);
                            }}
                            className="p-1.5 text-[#0070BA] hover:bg-[#0070BA]/10 rounded-md transition-colors"
                            title="Rechnung anzeigen / runterladen"
                          >
                            <FileText className="w-5 h-5" />
                          </a>
                          <button
                            onClick={() => handleItemFileClick(p.id)}
                            className="p-1.5 text-[#0070BA]/60 hover:text-[#0070BA] hover:bg-[#0070BA]/10 rounded-md transition-colors"
                            title="Rechnung ersetzen"
                          >
                            <Upload className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleItemFileClick(p.id)}
                          className="px-2.5 py-1.5 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 rounded-lg transition-colors flex items-center gap-1 text-xs font-semibold border border-amber-500/20"
                          title="Rechnung jetzt hinzufügen"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>Beleg</span>
                        </button>
                      )}

                      {/* Single-step Delete Confirmation */}
                      {deleting?.id === p.id ? (
                        <div className="flex items-center gap-1 bg-red-50 p-1 rounded-lg border border-red-100 animate-in fade-in slide-in-from-right-2">
                          <span className="text-[10px] font-bold text-red-600 px-2 uppercase tracking-tighter">
                            Wirklich löschen?
                          </span>
                          <button 
                            onClick={() => handleDelete(p.id)}
                            className="p-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                            title="Ja, jetzt löschen"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => setDeleting(null)}
                            className="p-1.5 bg-white text-[#141414]/40 rounded-md hover:bg-[#141414]/5 transition-colors"
                            title="Abbrechen"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => setDeleting({ id: p.id, stage: 1 })}
                          className="p-2 text-[#141414]/20 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                          title="Löschen"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </main>

      {/* Footer Info */}
      <footer className="max-w-5xl mx-auto px-6 py-10 border-t border-[#141414]/5 text-center">
        <p className="text-xs text-[#141414]/30 uppercase tracking-widest">
          Speicherort der Rechnungen: <code className="bg-[#141414]/5 px-2 py-1 rounded">Z:\Simeth\Paypal\Rechnung</code>
        </p>
      </footer>

      {/* Hidden file input for adding invoice later */}
      <input
        type="file"
        ref={itemFileInputRef}
        onChange={handleItemFileChange}
        className="hidden"
        accept=".pdf,.jpg,.jpeg,.png"
      />
    </div>
  );
}
