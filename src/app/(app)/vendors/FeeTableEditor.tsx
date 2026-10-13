"use client";
import { useState } from "react";
import { MoneyInput } from "@/components/MoneyInput";
import { FEE_ROLES, type FeeRole, type FeeRule } from "@/lib/fee-table";

type Row = { role: FeeRole; min: string; max: string; fee: string };

const toRow = (r: FeeRule): Row => ({ role: r.role, min: String(r.min), max: r.max === null ? "" : String(r.max), fee: String(r.fee) });
const digits = (v: string) => v.normalize("NFKC").replace(/[^\d]/g, "");

/** 単価表（従業員数×役職→協力金）の編集。送信値は feeTable（JSON） */
export function FeeTableEditor({ defaultRules }: { defaultRules: FeeRule[] }) {
  const [rows, setRows] = useState<Row[]>(() => defaultRules.map(toRow));
  const set = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const json = JSON.stringify(
    rows
      .filter((r) => r.min !== "" && r.fee !== "")
      .map((r) => ({ role: r.role, min: Number(r.min), max: r.max === "" ? null : Number(r.max), fee: Number(r.fee) })),
  );

  return (
    <div className="space-y-2">
      <input type="hidden" name="feeTable" value={json} />
      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="table text-sm">
            <thead>
              <tr>
                <th>従業員数（以上）</th>
                <th>従業員数（未満）</th>
                <th>役職</th>
                <th>協力金</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td>
                    <input className="input w-24 text-right" inputMode="numeric" value={r.min} onChange={(e) => set(i, { min: digits(e.target.value) })} />
                  </td>
                  <td>
                    <input className="input w-24 text-right" inputMode="numeric" placeholder="上限なし" value={r.max} onChange={(e) => set(i, { max: digits(e.target.value) })} />
                  </td>
                  <td>
                    <select className="input" value={r.role} onChange={(e) => set(i, { role: e.target.value as FeeRole })}>
                      {Object.entries(FEE_ROLES).map(([k, label]) => (
                        <option key={k} value={k}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="w-36">
                    <MoneyInput name={`_fee${i}`} value={r.fee} onChange={(fee) => set(i, { fee })} />
                  </td>
                  <td>
                    <button type="button" className="btn-secondary btn-sm" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>
                      削除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <button
        type="button"
        className="btn-secondary btn-sm"
        onClick={() => setRows((rs) => [...rs, rs.length ? { ...rs[rs.length - 1], fee: "" } : { role: "CEO", min: "", max: "", fee: "" }])}
      >
        + 行を追加
      </button>
      <p className="text-xs text-gray-500">
        紹介案件を作るとき、繋がりの「規模」と「役職」からこの表で報酬額を自動入力します。表に当てはまらない・判断できない場合は「単価未定」になります。表が空なら上の紹介報酬単価をそのまま使います。
      </p>
    </div>
  );
}
