import React, { useEffect, useState } from "react";
// Если у тебя есть файл с инициализацией Supabase, подключи его:
// import supabase from "./supabaseClient";

type Bike = {
  id: number;
  number: number | string;
  status: "free" | "rented" | "broken";
  pricePerDay?: number;
};

type Rental = {
  id: number;
  bikeId: number;
  renterName?: string;
  renterPhone?: string;
  startDate: string;
  endDate?: string | null;
  status: "active" | "finished" | "overdue";
  accrued: number; // amount owed total
  paid: number; // amount paid
  deposit?: number;
  notes?: string;
};

type Deposit = { id: number; amount: number; date: string; title?: string; rentalId?: number };

type StateShape = {
  bikes: Bike[];
  rentals: Rental[];
  deposits: Deposit[];
  sales: any[];
  charges: any[];
  expenses: any[];
  payments: any[];
  clients?: any[];
};

const STORAGE_KEY = "crm_bike_state_v4";

function uid() {
  return Math.floor(Math.random() * 1e9);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function loadState(): StateShape {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (!parsed.payments) parsed.payments = parsed.payments || [];
      return parsed;
    }
  } catch (e) {
    console.warn("Failed to parse storage", e);
  }
  const bikes = Array.from({ length: 8 }).map((_, i) => ({
    id: i + 1,
    number: i + 1,
    status: i === 0 ? "rented" : "free",
    pricePerDay: i === 0 ? 150 : 120,
  }));
  const rentals: Rental[] = [
    {
      id: uid(),
      bikeId: 1,
      renterName: "Шарипов",
      renterPhone: "99999999",
      startDate: "2025-01-01",
      status: "active",
      accrued: 2200,
      paid: 0,
      deposit: 500,
    },
  ];
  return { bikes, rentals, deposits: [], sales: [], charges: [], expenses: [], payments: [] };
}

function saveState(s: StateShape) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

function formatMoney(v: number | undefined | null) {
  if (!v && v !== 0) return "-";
  return `${v} сом`;
}

export default function App() {
  const [state, setState] = useState<StateShape>(() => loadState());
  const [section, setSection] = useState<"home" | "bikes" | "clients" | "money" | "settings" | "expenses" | "sales" | "history">("home");
  const [filter, setFilter] = useState<"all" | "active" | "free" | "overdue">("all");
  const [showAddBike, setShowAddBike] = useState(false);
  const [showAddRental, setShowAddRental] = useState(false);
  const [editingBike, setEditingBike] = useState<Bike | null>(null);
  const [selectedRental, setSelectedRental] = useState<Rental | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<number | "">("");
  const [query, setQuery] = useState("");
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [finishTarget, setFinishTarget] = useState<Rental | null>(null);
  const [finishWithhold, setFinishWithhold] = useState<number | "">("");

  // Сохранение в localStorage при изменении состояния
  useEffect(() => {
    saveState(state);
  }, [state]);

  // Загрузка данных из Supabase (если есть). Выполняется один раз при монтировании.
  useEffect(() => {
    let mounted = true;

    async function fetchAll() {
      try {
        if (typeof supabase === "undefined") {
          // supabase не определён — пропускаем загрузку (локальные данные будут использоваться)
          return;
        }

        const results = await Promise.all([
          supabase.from("bikes").select("*"),
          supabase.from("clients").select("*"),
          supabase.from("rentals").select("*"),
          supabase.from("payments").select("*"),
          supabase.from("expenses").select("*"),
          supabase.from("charges").select("*"),
          supabase.from("sales").select("*"),
          supabase.from("deposits").select("*"),
        ]);

        if (!mounted) return;

        const [bikesRes, clientsRes, rentalsRes, paymentsRes, expensesRes, chargesRes, salesRes, depositsRes] = results;

        setState((s) => ({
          ...s,
          bikes: bikesRes?.data ?? s.bikes ?? [],
          clients: clientsRes?.data ?? s.clients ?? [],
          rentals: rentalsRes?.data ?? s.rentals ?? [],
          payments: paymentsRes?.data ?? s.payments ?? [],
          expenses: expensesRes?.data ?? s.expenses ?? [],
          charges: chargesRes?.data ?? s.charges ?? [],
          sales: salesRes?.data ?? s.sales ?? [],
          deposits: depositsRes?.data ?? s.deposits ?? [],
        }));
      } catch (err) {
        console.error("Failed to load data from supabase", err);
      }
    }

    fetchAll();
    return () => {
      mounted = false;
    };
  }, []);

  // derived
  const activeRentals = state.rentals.filter((r) => r.status === "active");
  const overdueRentals = state.rentals.filter((r) => r.status === "overdue");
  const freeBikes = state.bikes.filter((b) => b.status === "free");
  const bikesCount = state.bikes.length;
  const depositsSum = (state.deposits || []).reduce((s, d) => s + Number(d.amount || 0), 0);
  const salesSum = state.sales ? state.sales.reduce((s: any, x: any) => s + Number(x.amount || 0), 0) : 0;
  const paymentsSum = state.payments ? state.payments.reduce((s: any, x: any) => s + Number(x.amount || 0), 0) : 0;
  const chargesSum = state.charges ? state.charges.reduce((s: any, x: any) => s + Number(x.amount || 0), 0) : 0;
  const expensesSum = state.expenses ? state.expenses.reduce((s: any, x: any) => s + Number(x.amount || 0), 0) : 0;
  const balance = (salesSum + paymentsSum) - (expensesSum + chargesSum);

  // actions
  function addBike(bike: Partial<Bike>) {
    const next: Bike = { id: uid(), number: bike.number || `#${uid()}`, status: bike.status || "free", pricePerDay: bike.pricePerDay || 120 };
    setState((s) => ({ ...s, bikes: [...s.bikes, next] }));
  }

  function editBikeSave(updated: Bike) {
    setState((s) => ({ ...s, bikes: s.bikes.map((b) => (b.id === updated.id ? updated : b)) }));
    setEditingBike(null);
    setShowAddBike(false);
  }

  function startRental(r: Partial<Rental>) {
    if (!r.bikeId) return alert("Выберите велосипед");
    const bike = state.bikes.find((b) => b.id === r.bikeId);
    if (!bike) return alert("Велосипед не найден");
    const rental: Rental = {
      id: uid(),
      bikeId: r.bikeId!,
      renterName: r.renterName || "Гость",
      renterPhone: r.renterPhone || "",
      startDate: r.startDate || today(),
      status: "active",
      accrued: Number(r.accrued || 0),
      paid: 0,
      deposit: Number(r.deposit || 0) || 0,
    };
    setState((s) => ({
      ...s,
      rentals: [...s.rentals, rental],
      bikes: s.bikes.map((b) => (b.id === r.bikeId ? { ...b, status: "rented" } : b)),
      deposits: r.deposit ? [...s.deposits, { id: uid(), rentalId: rental.id, amount: Number(r.deposit), date: today(), title: `Депозит ${r.renterName || ""}` }] : s.deposits,
    }));
    setShowAddRental(false);
  }

  function finishRental(rentalId: number, extraCharge = 0) {
    setState((s) => {
      const rentals = s.rentals.map((r) => (r.id === rentalId ? { ...r, status: "finished", endDate: today(), accrued: (Number(r.accrued || 0) + Number(extraCharge || 0)) } : r));
      const rental = s.rentals.find((x) => x.id === rentalId);
      const bikes = s.bikes.map((b) => (b.id === (rental?.bikeId) ? { ...b, status: "free" } : b));
      return { ...s, rentals, bikes };
    });
    setSelectedRental(null);
  }

  function openPayment(r: Rental) {
    setSelectedRental(r);
    setPaymentAmount("");
    setShowPaymentModal(true);
  }

  function applyPayment(rentalId: number, amount: number) {
    const payment = { id: uid(), amount, date: today(), rentalId };
    setState((s) => {
      const rentals = s.rentals.map((r) => (r.id === rentalId ? { ...r, paid: Number(r.paid || 0) + amount } : r));
      const payments = [...(s.payments || []), payment];
      return { ...s, rentals, payments };
    });
    try {
      if (typeof printReceipt === "function") printReceipt({ id: uid(), amount, date: today(), rentalId });
    } catch (e) {}
    setShowPaymentModal(false);
    setSelectedRental(null);
  }

  function finalizeRental(rentalId: number, withhold: number) {
    setState(s => {
      const rentals = s.rentals.map(r => r.id === rentalId ? { ...r, status: 'finished', endDate: today() } : r);
      const deposits = (s.deposits || []).slice();
      const depIndex = deposits.findIndex(d => d.rentalId === rentalId);
      let charges = s.charges ? s.charges.slice() : [];
      if (depIndex !== -1 && withhold > 0) {
        const dep = deposits[depIndex];
        const withheld = Math.min(Number(dep.amount || 0), withhold);
        charges = [...charges, { id: uid(), amount: withheld, date: today(), title: 'Удержан депозит', note: `Аренда ${rentalId}` }];
        if (withheld >= Number(dep.amount || 0)) {
          deposits.splice(depIndex, 1);
        } else {
          deposits[depIndex] = { ...dep, amount: Number(dep.amount) - withheld };
        }
      }
      const rental = s.rentals.find(x => x.id === rentalId);
      const bikes = s.bikes.map(b => b.id === (rental?.bikeId) ? { ...b, status: 'free' } : b);
      return { ...s, rentals, deposits, charges, bikes };
    });
  }

  function addDeposit(amount: number, title?: string) {
    setState((s) => ({ ...s, deposits: [...s.deposits, { id: uid(), amount, date: today(), title }] }));
  }

  function addSale(amount: number, title?: string, note?: string, date?: string) {
    const rec = { id: uid(), amount, date: date || today(), title: title || "Продажа", note: note || "" };
    setState(s => ({ ...s, sales: [...s.sales, rec] }));
  }

  function addCharge(amount: number, title?: string, note?:string, date?:string) {
    const rec = { id: uid(), amount, date: date || today(), title: title || "Списание", note: note || "" };
    setState(s => ({ ...s, charges: [...s.charges, rec] }));
  }

  function addExpense(amount: number, title?: string, note?:string, date?:string) {
    const rec = { id: uid(), amount, date: date || today(), title: title || "Расход", note: note || "" };
    setState(s => ({ ...s, expenses: [...s.expenses, rec] }));
  }

  function importJSON(raw: string) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed.bikes && parsed.rentals) {
        setState(parsed);
        alert("Импортировано");
      } else {
        alert("Неправильный формат JSON");
      }
    } catch (e) {
      alert("Ошибка парсинга JSON");
    }
  }

  function exportJSON() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "crm_bike_state_v4.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  const rentalsFiltered = state.rentals.filter((r) => {
    if (filter === "all") return true;
    if (filter === "active") return r.status === "active";
    if (filter === "free") return r.status === "finished";
    if (filter === "overdue") return r.status === "overdue";
    return true;
  }).filter(r => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (r.renterName || "").toLowerCase().includes(q) || String(r.bikeId).includes(q) || (r.renterPhone || "").includes(q);
  });

  // Design: simple responsive layout using inline styles to avoid new deps
  return (
    <div style={{ fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial", background: "#F8FAFC", minHeight: "100vh", color: "#0F172A" }}>
      <div style={{ maxWidth: 1100, margin: "24px auto", padding: 16 }}>
        {/* Header */}
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: "linear-gradient(135deg,#F472B6,#FB7185)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700 }}>K</div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>Kassa — аренда велосипедов</div>
                <div style={{ fontSize: 12, color: "#6B7280" }}>Быстрый CRM для управления арендой</div>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ textAlign: "right", minWidth: 120 }}>
              <div style={{ fontSize: 12, color: "#9CA3AF" }}>В аренде</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{activeRentals.length}</div>
            </div>
            <div style={{ textAlign: "right", minWidth: 120 }}>
              <div style={{ fontSize: 12, color: "#9CA3AF" }}>Депозиты</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{formatMoney(depositsSum)}</div>
            </div>
            <div style={{ textAlign: "right", minWidth: 120 }}>
              <div style={{ fontSize: 12, color: "#9CA3AF" }}>Баланс</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{formatMoney(balance)}</div>
            </div>

            <div>
              <button onClick={() => { setShowAddRental(true); setSection("home"); }} style={primaryBtn}>+ Добавить аренду</button>
            </div>
          </div>
        </header>

        {/* Nav */}
        <nav style={{ display: "flex", gap: 8, marginBottom: 18 }}>
          <NavButton active={section === "home"} onClick={() => setSection("home")}>Главная</NavButton>
          <NavButton active={section === "bikes"} onClick={() => setSection("bikes")}>Велосипеды ({bikesCount})</NavButton>
          <NavButton active={section === "clients"} onClick={() => setSection("clients")}>Клиенты</NavButton>
          <NavButton active={section === "expenses"} onClick={() => setSection("expenses")}>Расходы</NavButton>
          <NavButton active={section === "sales"} onClick={() => setSection("sales")}>С продажи</NavButton>
          <NavButton active={section === "history"} onClick={() => setSection("history")}>История аренд</NavButton>
          <NavButton active={section === "money"} onClick={() => setSection("money")}>Денежные операции</NavButton>
          <NavButton active={section === "settings"} onClick={() => setSection("settings")}>Настройки</NavButton>
        </nav>

        {/* Content */}
        <div style={{ display: "grid", gridTemplateColumns: section === "home" ? "1fr 360px" : "1fr", gap: 16 }}>
          <main style={{ background: "#fff", borderRadius: 12, padding: 16, boxShadow: "0 6px 18px rgba(15,23,42,0.04)" }}>
            {section === "home" && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 12 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <div style={{ fontWeight: 600 }}>Аренды</div>
                    <div style={{ fontSize: 13, color: "#6B7280" }}>{activeRentals.length} показано</div>
                  </div>

                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input placeholder="Поиск по клиенту или номеру" value={query} onChange={(e) => setQuery(e.target.value)} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #E5E7EB", minWidth: 240 }} />
                    <select value={filter} onChange={(e) => setFilter(e.target.value as any)} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #E5E7EB" }}>
                      <option value="all">Все</option>
                      <option value="active">В аренде</option>
                      <option value="free">Завершённые</option>
                      <option value="overdue">Просроченные</option>
                    </select>
                    <button onClick={() => exportJSON()} style={ghostBtn}>Экспорт</button>
                  </div>
                </div>

                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ textAlign: "left", borderBottom: "1px solid #EEF2F7" }}>
                        <th style={th}># велика</th>
                        <th style={th}>Клиент</th>
                        <th style={th}>Телефон</th>
                        <th style={th}>Старт</th>
                        <th style={{ ...th, textAlign: "right" }}>Долг</th>
                        <th style={{ ...th, textAlign: "right" }}>Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeRentals.map((r) => {
                        const due = Math.max(0, (Number(r.accrued || 0) - Number(r.paid || 0)));
                        return (
                          <tr key={r.id} style={{ borderBottom: "1px solid #F3F4F6" }}>
                            <td style={td}>{r.bikeId}</td>
                            <td style={td}>{r.renterName || "—"}</td>
                            <td style={td}>{r.renterPhone || "—"}</td>
                            <td style={td}>{r.startDate}</td>
                            <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{formatMoney(due)}</td>
                            <td style={{ ...td, textAlign: "right" }}>
                              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                                {r.status === "active" && <button onClick={() => openPayment(r)} style={miniPrimary}>Принять платёж</button>}
                                {r.status === "active" && <button onClick={() => { setFinishTarget(r); setFinishWithhold(0); setShowFinishModal(true); }} style={miniDanger}>Завершить</button>}
                                <button onClick={() => { setSelectedRental(r); alert(JSON.stringify(r, null, 2)); }} style={miniGhost}>Открыть</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {section === "bikes" && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div style={{ fontWeight: 700 }}>Велосипеды</div>
                  <div>
                    <button onClick={() => { setShowAddBike(true); setEditingBike(null); }} style={primaryBtn}>+ Добавить велосипед</button>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px,1fr))", gap: 12 }}>
                  {state.bikes.map((b) => (
                    <div key={b.id} style={{ padding: 12, background: "#fff", borderRadius: 8, border: "1px solid #EEF2F7" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <div style={{ fontWeight: 700 }}>#{b.number}</div>
                          <div style={{ fontSize: 13, color: "#6B7280" }}>{b.status}</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontWeight: 700 }}>{b.pricePerDay} сом/дн</div>
                          <div style={{ display: "flex", gap: 8, marginTop: 8, justifyContent: "flex-end" }}>
                            <button onClick={() => { setEditingBike(b); setShowAddBike(true); }} style={miniGhost}>Изменить</button>
                            <button onClick={() => {
                              if (!confirm("Удалить велосипед?")) return;
                              setState(s => ({ ...s, bikes: s.bikes.filter(x => x.id !== b.id) }));
                            }} style={miniDanger}>Удалить</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {section === "clients" && (
              <>
                <div style={{ fontWeight: 700, marginBottom: 12 }}>Клиенты</div>
                <div style={{ padding: 12, background: "#fff", borderRadius: 8 }}>
                  <div style={{ color: "#6B7280", marginBottom: 8 }}>Клиенты формируются из аренды (функция упрощена в этой версии).</div>
                  <div style={{ fontSize: 13 }}>Всего клиентов (по уникальным именам): {Array.from(new Set(state.rentals.map(r => r.renterName))).length}</div>
                  <ul style={{ marginTop: 12 }}>
                    {Array.from(new Set(state.rentals.map(r => r.renterName))).map((name) => <li key={name}>{name}</li>)}
                  </ul>
                </div>
              </>
            )}

            {section === "money" && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div style={{ fontWeight: 700 }}>Денежные операции</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => {
                      const amt = Number(prompt("Сумма депозита", "500"));
                      if (amt) addDeposit(amt, "Ручной депозит");
                    }} style={ghostBtn}>+ Депозит</button>
                    <button onClick={() => {
                      const amt = Number(prompt("Сумма расхода", "1000"));
                      if (!amt) return;
                      setState(s => ({ ...s, expenses: [...s.expenses, { id: uid(), amount: amt, date: today(), title: "Ручной расход" }] }))
                    }} style={ghostBtn}>+ Расход</button>
                    <button onClick={() => exportJSON()} style={ghostBtn}>Экспорт</button>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 12 }}>
                  <div style={{ background: "#fff", padding: 12, borderRadius: 8 }}>
                    <div style={{ fontWeight: 600, marginBottom: 8 }}>Платежи</div>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead><tr style={{ borderBottom: "1px solid #EEF2F7" }}><th style={th}>Дата</th><th style={th}>Сумма</th><th style={th}>Аренда</th></tr></thead>
                      <tbody>
                        {state.payments && state.payments.length ? state.payments.map(p => <tr key={p.id}><td style={td}>{p.date}</td><td style={td}>{formatMoney(Number(p.amount || 0))}</td><td style={td}>{p.rentalId}</td></tr>) : <tr><td style={td} colSpan={3}>Платежей пока нет</td></tr>}
                      </tbody>
                    </table>
                  </div>

                  <aside style={{ background: "#fff", padding: 12, borderRadius: 8 }}>
                    <div style={{ fontWeight: 600 }}>Баланс</div>
                    <div style={{ fontSize: 20, fontWeight: 700, marginTop: 8 }}>{formatMoney(balance)}</div>
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontSize: 13, color: "#6B7280" }}>Депозиты</div>
                      <div style={{ fontWeight: 700, marginTop: 6 }}>{formatMoney(depositsSum)}</div>
                    </div>
                  </aside>
                </div>
              </>
            )}

            {section === "expenses" && (
              <>
                <div style={{ fontWeight: 700, marginBottom: 12 }}>Расходы</div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                  <div style={{ color: "#6B7280" }}>Все расходы. Добавлять можно кнопку "+ Расход".</div>
                  <div style={{ display: "flex", gap:8 }}>
                    <button onClick={() => {
                      const date = prompt("Дата (YYYY-MM-DD)", today());
                      const amount = Number(prompt("Сумма", "1000"));
                      const title = prompt("Название", "Расход");
                      const note = prompt("Примечание", "");
                      if (!amount) return;
                      addExpense(amount, title, note, date || undefined);
                    }} style={ghostBtn}>+ Расход</button>
                    <button onClick={() => exportJSON()} style={ghostBtn}>Экспорт</button>
                  </div>
                </div>

                <div style={{ background: "#fff", padding: 12, borderRadius: 8 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead><tr style={{ borderBottom: "1px solid #EEF2F7" }}><th style={th}>Дата</th><th style={th}>Сумма</th><th style={th}>Название</th><th style={th}>Примечание</th></tr></thead>
                    <tbody>
                      {state.expenses && state.expenses.length ? state.expenses.map(ex => <tr key={ex.id}><td style={td}>{ex.date}</td><td style={td}>{formatMoney(Number(ex.amount||0))}</td><td style={td}>{ex.title}</td><td style={td}>{ex.note||""}</td></tr>) : <tr><td style={td} colSpan={4}>Расходов пока нет</td></tr>}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {section === "sales" && (
              <>
                <div style={{ fontWeight: 700, marginBottom: 12 }}>С продажи</div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                  <div style={{ color: "#6B7280" }}>Продажи и поступления.</div>
                  <div style={{ display: "flex", gap:8 }}>
                    <button onClick={() => {
                      const date = prompt("Дата (YYYY-MM-DD)", today());
                      const amount = Number(prompt("Сумма", "1000"));
                      const title = prompt("Название", "Продажа");
                      const note = prompt("Примечание", "");
                      if (!amount) return;
                      addSale(amount, title, note, date || undefined);
                    }} style={ghostBtn}>+ Продажа</button>
                    <button onClick={() => exportJSON()} style={ghostBtn}>Экспорт</button>
                  </div>
                </div>

                <div style={{ background: "#fff", padding: 12, borderRadius: 8 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead><tr style={{ borderBottom: "1px solid #EEF2F7" }}><th style={th}>Дата</th><th style={th}>Сумма</th><th style={th}>Название</th><th style={th}>Примечание</th></tr></thead>
                    <tbody>
                      {state.sales && state.sales.length ? state.sales.map(sale => <tr key={sale.id}><td style={td}>{sale.date}</td><td style={td}>{formatMoney(Number(sale.amount||0))}</td><td style={td}>{sale.title}</td><td style={td}>{sale.note||""}</td></tr>) : <tr><td style={td} colSpan={4}>Продаж пока нет</td></tr>}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {section === "history" && (
              <>
                <div style={{ fontWeight: 700, marginBottom: 12 }}>История аренд</div>
                <div style={{ background: "#fff", padding: 12, borderRadius: 8 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead><tr style={{ borderBottom: "1px solid #EEF2F7" }}><th style={th}># велика</th><th style={th}>Клиент</th><th style={th}>Старт</th><th style={th}>Конец</th><th style={th}>Сумма</th></tr></thead>
                    <tbody>
                      {state.rentals && state.rentals.filter(r=>r.status==='finished').length ? state.rentals.filter(r=>r.status==='finished').map(r => <tr key={r.id}><td style={td}>{r.bikeId}</td><td style={td}>{r.renterName}</td><td style={td}>{r.startDate}</td><td style={td}>{r.endDate||""}</td><td style={td}>{formatMoney(Number(r.accrued||0))}</td></tr>) : <tr><td style={td} colSpan={5}>Завершённых аренд пока нет</td></tr>}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            {section === "settings" && (
              <>
                <div style={{ fontWeight: 700, marginBottom: 12 }}>Настройки и данные</div>
                <div style={{ padding: 12, background: "#fff", borderRadius: 8 }}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => { localStorage.removeItem(STORAGE_KEY); setState(loadState()); alert("Локальное состояние сброшено"); }} style={ghostDanger}>Сбросить состояние</button>
                    <button onClick={() => {
                      const raw = prompt("Вставьте JSON для импорта");
                      if (raw) importJSON(raw);
                    }} style={ghostBtn}>Импорт JSON</button>
                    <button onClick={() => exportJSON()} style={ghostBtn}>Экспорт текущего состояния</button>
                  </div>

                  <div style={{ marginTop: 12, fontSize: 13, color: "#6B7280" }}>
                    Резервная копия и импорт полезны если вы хотите поменять данные вручную.
                  </div>
                </div>
              </>
            )}
          </main>

          {/* Right column: quick actions + stats */}
          <aside style={{ display: section === "home" ? "block" : "none" }}>
            <div style={{ width: 320 }}>
              <div style={{ background: "#fff", padding: 12, borderRadius: 12, marginBottom: 12 }}>
                <div style={{ fontWeight: 700 }}>Быстрые действия</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                  <button onClick={() => { setShowAddRental(true); }} style={primaryBtn}>+ Добавить аренду</button>
                  <button onClick={() => { setShowAddBike(true); setEditingBike(null); }} style={ghostBtn}>+ Добавить велосипед</button>
                  <button onClick={() => { exportJSON(); }} style={ghostBtn}>Экспортировать данные</button>
                </div>
              </div>

              <div style={{ background: "#fff", padding: 12, borderRadius: 12 }}>
                <div style={{ fontWeight: 700 }}>Статистика</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
                  <Stat label="Всего великов" value={bikesCount} />
                  <Stat label="В аренде" value={activeRentals.length} />
                  <Stat label="Просрочено" value={overdueRentals.length} danger />
                  <Stat label="Депозиты" value={formatMoney(depositsSum)} />
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* Add Bike Modal */}
      {showAddBike && (
        <Modal onClose={() => setShowAddBike(false)} title={editingBike ? "Изменить велосипед" : "Добавить велосипед"}>
          <BikeForm bike={editingBike} onCancel={() => setShowAddBike(false)} onSave={(b) => {
            if (editingBike) editBikeSave(b);
            else addBike(b);
            setShowAddBike(false);
          }} />
        </Modal>
      )}

      {/* Add Rental Modal */}
      {showAddRental && (
        <Modal onClose={() => setShowAddRental(false)} title="Добавить аренду">
          <RentalForm bikes={state.bikes.filter(b => b.status === "free")} onCancel={() => setShowAddRental(false)} onSave={(r) => startRental(r)} />
        </Modal>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedRental && (
        <Modal onClose={() => setShowPaymentModal(false)} title={`Платёж — ${selectedRental.renterName || selectedRental.id}`}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="number" placeholder="Сумма" value={paymentAmount as any} onChange={(e) => setPaymentAmount(e.target.value === "" ? "" : Number(e.target.value))} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #E5E7EB", minWidth: 120 }} />
            <button onClick={() => { if (!paymentAmount) return alert("Введите сумму"); applyPayment(selectedRental.id, Number(paymentAmount)); }} style={primaryBtn}>Принять</button>
            <button onClick={() => { setShowPaymentModal(false); }} style={ghostBtn}>Отмена</button>
          </div>
        </Modal>
      )}

      {/* Finish Rental Modal */}
      {showFinishModal && finishTarget && (
        <Modal onClose={() => setShowFinishModal(false)} title={`Завершить аренду — ${finishTarget.renterName || finishTarget.id}`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div>Депозит к аренде: {(() => { const dep = state.deposits.find(d => d.rentalId === finishTarget.id); return dep ? formatMoney(Number(dep.amount || 0)) : '—' })()}</div>
            <label>Снять с депозита (сом)</label>
            <input type="number" value={finishWithhold as any} onChange={(e) => setFinishWithhold(e.target.value === '' ? '' : Number(e.target.value))} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #E5E7EB' }} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowFinishModal(false); }} style={ghostBtn}>Отмена</button>
              <button onClick={() => {
                const w = Number(finishWithhold || 0);
                if (w < 0) return alert('Неверная сумма');
                finalizeRental(finishTarget.id, w);
                setShowFinishModal(false);
                setFinishTarget(null);
              }} style={primaryBtn}>Завершить аренду</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* Small UI primitives */

function NavButton({ children, onClick, active }: { children: any; onClick?: any; active?: boolean }) {
  return <button onClick={onClick} style={{ padding: "8px 12px", borderRadius: 10, border: "none", background: active ? "#F472B6" : "transparent", color: active ? "#fff" : "#6B7280", fontWeight: 600 }}>{children}</button>;
}

function Stat({ label, value, danger }: { label: string; value: any; danger?: boolean }) {
  return <div style={{ padding: 10, borderRadius: 8, background: "#F8FAFC", textAlign: "center", border: danger ? "1px solid #FECACA" : "1px solid #E6EEFF" }}><div style={{ fontSize: 12, color: "#6B7280" }}>{label}</div><div style={{ fontWeight: 700, marginTop: 6 }}>{value}</div></div>;
}

function Modal({ children, onClose, title }: any) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(2,6,23,0.6)" }}>
      <div style={{ width: 640, maxWidth: "94%", background: "#fff", borderRadius: 12, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ fontWeight: 700 }}>{title}</div>
          <div><button onClick={onClose} style={ghostBtn}>✕</button></div>
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
}

function BikeForm({ bike, onSave, onCancel }: any) {
  const [number, setNumber] = useState(bike?.number || "");
  const [pricePerDay, setPrice] = useState(bike?.pricePerDay || 120);
  function save() {
    if (!number) return alert("Введите номер");
    const next = { ...(bike || {}), number, pricePerDay };
    onSave(next);
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <label>Номер (вводите без #)</label>
      <input value={number} onChange={(e) => setNumber(e.target.value)} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #E5E7EB" }} />
      <label>Цена в день</label>
      <input type="number" value={pricePerDay as any} onChange={(e) => setPrice(Number(e.target.value))} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #E5E7EB" }} />
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button onClick={save} style={primaryBtn}>Сохранить</button>
        <button onClick={onCancel} style={ghostBtn}>Отмена</button>
      </div>
    </div>
  );
}

function RentalForm({ bikes, onSave, onCancel }: any) {
  const [bikeId, setBikeId] = useState(bikes[0]?.id || "");
  const [renterName, setRenterName] = useState("");
  const [renterPhone, setRenterPhone] = useState("");
  const [deposit, setDeposit] = useState<number | "">("");
  const [accrued, setAccrued] = useState<number | "">("");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <label>Велосипед</label>
      <select value={bikeId} onChange={(e) => setBikeId(Number(e.target.value))} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #E5E7EB" }}>
        <option value="">Выберите велосипед</option>
        {bikes.map((b: any) => <option key={b.id} value={b.id}>{b.number} — {b.pricePerDay} сом/дн</option>)}
      </select>
      <label>Клиент</label>
      <input value={renterName} onChange={(e) => setRenterName(e.target.value)} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #E5E7EB" }} />
      <label>Телефон</label>
      <input value={renterPhone} onChange={(e) => setRenterPhone(e.target.value)} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #E5E7EB" }} />
      <label>Депозит (сом)</label>
      <input type="number" value={deposit as any} onChange={(e) => setDeposit(e.target.value === "" ? "" : Number(e.target.value))} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #E5E7EB" }} />
      <label>Изначальная задолженность (если есть)</label>
      <input type="number" value={accrued as any} onChange={(e) => setAccrued(e.target.value === "" ? "" : Number(e.target.value))} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #E5E7EB" }} />
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button onClick={() => { onSave({ bikeId, renterName, renterPhone, deposit: deposit || 0, accrued: accrued || 0 }); }} style={primaryBtn}>Создать аренду</button>
        <button onClick={onCancel} style={ghostBtn}>Отмена</button>
      </div>
    </div>
  );
}

/* Buttons and table styles */
const primaryBtn: React.CSSProperties = { background: "linear-gradient(135deg,#F472B6,#FB7185)", color: "#fff", padding: "8px 12px", borderRadius: 10, border: "none", fontWeight: 700, cursor: "pointer" };
const ghostBtn: React.CSSProperties = { background: "#fff", color: "#374151", padding: "8px 12px", borderRadius: 10, border: "1px solid #E5E7EB", fontWeight: 700, cursor: "pointer" };
const ghostDanger: React.CSSProperties = { background: "#fff", color: "#EF4444", padding: "8px 12px", borderRadius: 10, border: "1px solid #FECACA", fontWeight: 700, cursor: "pointer" };
const miniPrimary: React.CSSProperties = { background: "#F472B6", color: "#fff", padding: "6px 8px", borderRadius: 8, border: "none", fontWeight: 700, cursor: "pointer", fontSize: 13 };
const miniDanger: React.CSSProperties = { background: "#FEE2E2", color: "#991B1B", padding: "6px 8px", borderRadius: 8, border: "none", fontWeight: 700, cursor: "pointer", fontSize: 13 };
const miniGhost: React.CSSProperties = { background: "transparent", color: "#6B7280", padding: "6px 8px", borderRadius: 8, border: "1px solid transparent", cursor: "pointer", fontSize: 13 };

const th: React.CSSProperties = { padding: "12px 8px", fontSize: 13, color: "#6B7280", fontWeight: 700 };
const td: React.CSSProperties = { padding: "12px 8px", fontSize: 14 };
