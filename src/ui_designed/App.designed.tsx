import React, { useEffect, useState } from "react";

/**
 * App.designed.tsx
 * Lightweight, self-contained UI to preview a cleaner design without changing original logic.
 * - Reads state from localStorage key "crm_bike_state_v4" used by the original app.
 * - Shows header with KPIs and a responsive rentals list.
 * To use: import and render <DesignedApp /> instead of default App, or replace App.tsx with this file.
 */

function formatMoney(v) {
  if (v == null) return "-";
  return v.toString() + " сом";
}

export default function DesignedApp() {
  const [state, setState] = useState({ bikes: [], rentals: [], deposits: [] });
  useEffect(() => {
    try {
      const raw = localStorage.getItem("crm_bike_state_v4");
      if (raw) {
        const parsed = JSON.parse(raw);
        setState({
          bikes: parsed.bikes || [],
          rentals: parsed.rentals || [],
          deposits: parsed.deposits || [],
        });
        return;
      }
    } catch(e){
      console.warn("Failed to read crm_bike_state_v4", e);
    }
    // fallback: try to read top-level keys
    try {
      const rawAll = localStorage.getItem("crm_bike_state") || localStorage.getItem("crm_state");
      if (rawAll) {
        const parsed = JSON.parse(rawAll);
        setState({
          bikes: parsed.bikes || [],
          rentals: parsed.rentals || [],
          deposits: parsed.deposits || [],
        });
      }
    } catch(e){}
  }, []);

  const activeCount = state.rentals.filter(r => r.status === "rented" || r.status === "active").length;
  const overdueCount = state.rentals.filter(r => r.status && r.status.toLowerCase().includes("overdue")).length;
  const depositsSum = state.deposits.reduce((s, d) => s + (Number(d.amount) || 0), 0);

  return (
    <div style={{fontFamily: "Inter, system-ui, sans-serif", background: "#F8FAFC", minHeight: "100vh", padding: 20}}>
      <header style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20}}>
        <div>
          <h1 style={{margin:0, fontSize: 22}}>Kassa — аренда велосипедов</h1>
          <div style={{color: "#6B7280", marginTop:6}}>Удобный минималистичный интерфейс для работы с арендой</div>
        </div>

        <div style={{display:"flex", gap:12, alignItems:"center"}}>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:12, color:"#9CA3AF"}}>В аренде</div>
            <div style={{fontWeight:600, fontSize:16}}>{activeCount}</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:12, color:"#9CA3AF"}}>Просроченные</div>
            <div style={{fontWeight:600, fontSize:16, color: overdueCount ? "#DC2626" : "inherit"}}>{overdueCount}</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:12, color:"#9CA3AF"}}>Депозиты</div>
            <div style={{fontWeight:600, fontSize:16}}>{formatMoney(depositsSum)}</div>
          </div>
        </div>
      </header>

      <main>
        <section style={{marginBottom: 16}}>
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8}}>
            <h2 style={{margin:0, fontSize:16}}>Аренды</h2>
            <div style={{color:"#6B7280", fontSize:13}}>{state.rentals.length} записей</div>
          </div>

          <div style={{background:"#fff", borderRadius:8, padding:12, boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
            {state.rentals.length === 0 ? (
              <div style={{padding:30, textAlign:"center", color:"#9CA3AF"}}>Нет аренды — попробуйте создать новую запись в основном приложении</div>
            ) : (
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%", borderCollapse:"collapse"}}>
                  <thead>
                    <tr style={{textAlign:"left", borderBottom:"1px solid #EEF2F7"}}>
                      <th style={{padding:"10px 8px"}}># велика</th>
                      <th style={{padding:"10px 8px"}}>Клиент</th>
                      <th style={{padding:"10px 8px"}}>Статус</th>
                      <th style={{padding:"10px 8px", textAlign:"right"}}>Начало</th>
                      <th style={{padding:"10px 8px", textAlign:"right"}}>Долг</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.rentals.map(r => (
                      <tr key={r.id} style={{borderBottom:"1px solid #F3F4F6"}}>
                        <td style={{padding:"10px 8px"}}>{r.bikeId ?? r.bike}</td>
                        <td style={{padding:"10px 8px"}}>{r.renterName ?? r.clientName ?? "-"}</td>
                        <td style={{padding:"10px 8px"}}>
                          <span style={{
                            display:"inline-block", padding:"4px 8px", borderRadius:999,
                            background: r.status && r.status.toLowerCase().includes("overdue") ? "#FEE2E2" : "#ECFEF0",
                            color: r.status && r.status.toLowerCase().includes("overdue") ? "#991B1B" : "#065F46",
                            fontSize:12, fontWeight:600
                          }}>{r.status ?? "—"}</span>
                        </td>
                        <td style={{padding:"10px 8px", textAlign:"right"}}>{r.startDate ?? "-"}</td>
                        <td style={{padding:"10px 8px", textAlign:"right"}}>{formatMoney((Number(r.accrued||0) - Number(r.paid||0)) || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        <section>
          <h3 style={{marginTop:0, fontSize:14}}>Быстрые действия</h3>
          <div style={{display:"flex", gap:8, flexWrap:"wrap"}}>
            <button onClick={()=>alert("Открыть основное приложение для добавления аренды")} style={btnStyle}>+ Добавить аренду</button>
            <button onClick={()=>{ localStorage.removeItem("crm_bike_state_v4"); alert("Удалил crm_bike_state_v4. Перезагрузите страницу.") }} style={btnStyleSecondary}>Сбросить локальное состояние</button>
            <button onClick={()=>{
              const raw = localStorage.getItem("crm_bike_state_v4");
              if (!raw) { alert("Нет данных в crm_bike_state_v4"); return; }
              const blob = new Blob([raw], {type:"application/json"});
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a"); a.href = url; a.download = "crm_bike_state_v4.json"; a.click(); URL.revokeObjectURL(url);
            }} style={btnStyleSecondary}>Экспорт JSON</button>
          </div>
        </section>
      </main>
    </div>
  );
}

const btnStyle = {
  background: "#F472B6",
  color: "#fff",
  padding: "8px 12px",
  borderRadius: 8,
  border: "none",
  cursor: "pointer",
  fontWeight: 600
};

const btnStyleSecondary = {
  background: "#fff",
  color: "#374151",
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid #E5E7EB",
  cursor: "pointer",
  fontWeight: 600
};
