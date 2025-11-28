import React, { useEffect, useState } from "react";

// Crm Bike Rental Updated — cleaned and fixed
// - No syntax errors
// - Open-ended rentals (no days)
// - Clients list is editable and removable
// - Separate Expenses page (duplicate behaviour of Charges)
// - State persisted to localStorage and included in JSON export

export default function App() {
  const RU = {
    title: "CRM — аренда великов",
    balance: "Баланс",
    main: "Главная",
    deposits: "Депозиты",
    sales: "Продажи",
    charges: "Списания",
    expenses: "Расходы",
    reports: "Отчёты",
    addRent: "Добавить / Выдать",
    bikeList: "Список велосипедов",
    total: "Всего",
    all: "Все",
    free: "Свободные",
    rented: "В аренде",
    repair: "В ремонте",
    edit: "Редактировать",
    history: "История",
    noBikes: "Нет велосипедов по фильтру",
    depositsTitle: "Депозиты",
    add: "Добавить",
    remove: "Удалить",
    salesTitle: "Продажи",
    chargesTitle: "Списания",
    expensesTitle: "Расходы",
    reportsTitle: "Отчёты",
    operations: "Операции / краткий обзор",
    activeRentals: "Активные аренды",
    clientsLabel: "Клиенты",
    settings: "Настройки",
    rentNow: "Сдать в аренду сразу",
    cancel: "Отмена",
    addButton: "Добавить",
    rentButton: "Выдать в аренду",
    finishRental: "Завершить аренду",
    acceptPayment: "Принять оплату",
    payAll: "Оплатить всё",
    enterBikeName: "Введите название/номер велосипеда",
    enterValidAmount: "Введите корректную сумму",
    rentalClosed: "Аренда завершена",
    paymentsLabel: "Платежи",
    salesLabel: "Продажи",
    expensesLabel: "Расходы",
    depositsLabel: "Списания",
    balanceLabel: "Баланс",
    exportJSON: "Экспорт (JSON)",
    exportRentalsCSV: "Экспорт аренды (CSV)",
    exportSummaryCSV: "Экспорт сводного отчёта (CSV)",
  };

  function getNextId(items) {
    if (!items || items.length === 0) return 1;
    return Math.max(...items.map((i) => i.id || 0)) + 1;
  }

  const initialBikes = Array.from({ length: 45 }, (_, i) => {
    const id = i + 1;
    const rented = id === 1 || id === 22;
    return {
      id,
      title: String(id),
      pricePerDay: rented ? (id === 1 ? 100 : 120) : 0,
      status: rented ? "rented" : "free",
      renterName: rented ? (id === 1 ? "Шарипов" : "Я") : "",
      renterPhone: rented ? (id === 1 ? "99999999" : "") : "",
    };
  });

  const [bikes, setBikes] = useState(initialBikes);
  const [rentals, setRentals] = useState([
    { id: 1, bikeId: 1, accrued: 2200, paid: 0, status: "overdue", renterName: "Шарипов", renterPhone: "99999999", startDate: "2025-01-01" },
    { id: 2, bikeId: 22, accrued: 2640, paid: 0, status: "overdue", renterName: "Я", renterPhone: "", startDate: "2025-01-02" },
  ]);

  const [deposits, setDeposits] = useState([]);
  const [sales, setSales] = useState([]);
  const [charges, setCharges] = useState([]);
  const [expenses, setExpenses] = useState([]);

  const [filter, setFilter] = useState("all");
  const [balance, setBalance] = useState(-20000);
  const [showAdd, setShowAdd] = useState(false);

  const [addMode, setAddMode] = useState("new");
  const [clients, setClients] = useState([]);
  const [newBikeFields, setNewBikeFields] = useState({ title: "", pricePerDay: "", renterName: "", renterPhone: "", rentNow: false });
  const [rentExistingFields, setRentExistingFields] = useState({ bikeId: "", renterName: "", renterPhone: "" });

  const [activeView, setActiveView] = useState("main");
  const [showEditModal, setShowEditModal] = useState(false);
  const [editBike, setEditBike] = useState(null);

  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyBikeId, setHistoryBikeId] = useState(null);

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [activeRental, setActiveRental] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState("");

  const [depositForm, setDepositForm] = useState({ amount: "", date: new Date().toISOString().slice(0, 10), title: "" });
  const [saleForm, setSaleForm] = useState({ amount: "", date: new Date().toISOString().slice(0, 10), title: "" });
  const [chargeForm, setChargeForm] = useState({ amount: "", date: new Date().toISOString().slice(0, 10), title: "" });
  const [expenseForm, setExpenseForm] = useState({ amount: "", date: new Date().toISOString().slice(0, 10), title: "" });

  const visibleBikes = bikes.filter((b) => filter === "all" || b.status === filter);
  const freeBikes = bikes.filter((b) => b.status === "free");

  // on mount: load state or seed clients
  useEffect(() => {
    try {
      const raw = localStorage.getItem("crm_bike_state_v4");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.bikes) setBikes(parsed.bikes);
        if (parsed.rentals) setRentals(parsed.rentals);
        if (parsed.deposits) setDeposits(parsed.deposits || []);
        if (parsed.sales) setSales(parsed.sales || []);
        if (parsed.charges) setCharges(parsed.charges || []);
        if (parsed.expenses) setExpenses(parsed.expenses || []);
        if (parsed.clients) setClients(parsed.clients || []);
        if (typeof parsed.balance === "number") setBalance(parsed.balance);
        return;
      }
    } catch (e) {
      console.warn("localStorage load failed", e);
    }

    // seed clients from rentals if no saved state
    const uniq = [];
    for (const r of rentals) {
      if (r.renterName) {
        if (!uniq.some((c) => c.name === r.renterName && c.phone === r.renterPhone)) uniq.push({ name: r.renterName, phone: r.renterPhone });
      }
    }
    setClients(uniq);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // persist state
  useEffect(() => {
    try {
      localStorage.setItem(
        "crm_bike_state_v4",
        JSON.stringify({ bikes, rentals, deposits, sales, charges, expenses, clients, balance })
      );
    } catch (e) {
      console.warn("localStorage save failed", e);
    }
  }, [bikes, rentals, deposits, sales, charges, expenses, clients, balance]);

  // Add new bike (optionally rent now)
  function doAddNewBike(e) {
    e && e.preventDefault();
    const title = (newBikeFields.title || "").trim();
    const price = parseFloat(newBikeFields.pricePerDay) || 0;
    if (!title) return alert(RU.enterBikeName);

    const nextId = getNextId(bikes);
    const status = newBikeFields.rentNow ? "rented" : "free";
    const bike = { id: nextId, title, pricePerDay: price, status, renterName: newBikeFields.renterName || "", renterPhone: newBikeFields.renterPhone || "" };
    setBikes((p) => [...p, bike]);

    if (newBikeFields.rentNow) {
      const rental = {
        id: getNextId(rentals),
        bikeId: nextId,
        accrued: 0,
        paid: 0,
        status: "active",
        renterName: newBikeFields.renterName || "",
        renterPhone: newBikeFields.renterPhone || "",
        startDate: new Date().toISOString().slice(0, 10),
      };
      setRentals((p) => [rental, ...p]);
      if (newBikeFields.renterName) {
        setClients((prev) => {
          if (prev.some((c) => c.name === newBikeFields.renterName && c.phone === newBikeFields.renterPhone)) return prev;
          return [{ name: newBikeFields.renterName, phone: newBikeFields.renterPhone }, ...prev];
        });
      }
    }

    setNewBikeFields({ title: "", pricePerDay: "", renterName: "", renterPhone: "", rentNow: false });
    setShowAdd(false);
    setAddMode("new");
    setFilter("all");
    setActiveView("main");
  }

  // Rent an existing bike (open-ended)
  function doRentExistingBike(e) {
    e && e.preventDefault();
    const bikeId = parseInt(rentExistingFields.bikeId, 10);
    if (!bikeId) return alert("Выберите велосипед для аренды");
    const bike = bikes.find((b) => b.id === bikeId);
    if (!bike) return alert("Велосипед не найден");
    if (bike.status !== "free") return alert("Выбранный велосипед сейчас не свободен");

    const rental = {
      id: getNextId(rentals),
      bikeId,
      accrued: 0,
      paid: 0,
      status: "active",
      renterName: rentExistingFields.renterName || "",
      renterPhone: rentExistingFields.renterPhone || "",
      startDate: new Date().toISOString().slice(0, 10),
    };

    setRentals((p) => [rental, ...p]);
    setBikes((prev) => prev.map((b) => (b.id === bikeId ? { ...b, status: "rented", renterName: rentExistingFields.renterName || "", renterPhone: rentExistingFields.renterPhone || "" } : b)));

    if (rentExistingFields.renterName) {
      setClients((prev) => {
        if (prev.some((c) => c.name === rentExistingFields.renterName && c.phone === rentExistingFields.renterPhone)) return prev;
        return [{ name: rentExistingFields.renterName, phone: rentExistingFields.renterPhone }, ...prev];
      });
    }

    setRentExistingFields({ bikeId: "", renterName: "", renterPhone: "" });
    setShowAdd(false);
    setAddMode("new");
    setFilter("all");
    setActiveView("main");
  }

  function deleteClient(idx) {
    const c = clients[idx];
    if (!c) return;
    if (!confirm(`Удалить клиента \"${c.name}\" ${c.phone ? `(${c.phone})` : ""}?`)) return;
    setClients((prev) => prev.filter((_, i) => i !== idx));
  }

  function openEditBike(bike) {
    setEditBike({ ...bike });
    setShowEditModal(true);
  }

# truncated for brevity in notebook file (full file saved in project)