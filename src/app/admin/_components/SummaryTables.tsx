"use client";

import { CheckCircle, Clock3 } from "lucide-react";

import { formatYuan } from "@/lib/domain";
import type { CustomerDto, DashboardDto } from "@/lib/types";

export function PayrollSummary({ dashboard }: { dashboard: DashboardDto }) {
  return (
    <section className="payroll-summary">
      <div className="panel">
        <div className="section-title">
          <h2>员工酬劳</h2>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>陪玩</th>
                <th>单数</th>
                <th className="amount-heading">应发</th>
                <th className="amount-heading">未发</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.payrollByPlayer.length > 0 ? (
                dashboard.payrollByPlayer.map((row) => (
                  <tr key={row.playerId}>
                    <td>{row.playerName}</td>
                    <td>{row.count}</td>
                    <td className="amount-cell">{formatYuan(row.amountCents)}</td>
                    <td className="amount-cell">{formatYuan(row.unpaidCents || 0)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="table-empty" colSpan={4}>
                    暂无数据
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="panel">
        <div className="section-title">
          <h2>归属提成</h2>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>归属人</th>
                <th>单数</th>
                <th className="amount-heading">提成</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.ownerCommissionByPlayer.length > 0 ? (
                dashboard.ownerCommissionByPlayer.map((row) => (
                  <tr key={row.playerId}>
                    <td>{row.playerName}</td>
                    <td>{row.count}</td>
                    <td className="amount-cell">{formatYuan(row.amountCents)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="table-empty" colSpan={3}>
                    暂无数据
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

export function CustomerSummary({
  dashboard,
  customerById,
}: {
  dashboard: DashboardDto;
  customerById: Map<string, CustomerDto>;
}) {
  return (
    <section className="grid">
      <div className="section-title">
        <h2>老板消费</h2>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>老板</th>
              <th>单数</th>
              <th className="amount-heading">已审核消费</th>
              <th className="amount-heading">未收款</th>
              <th>档案状态</th>
              <th>归属人</th>
            </tr>
          </thead>
          <tbody>
            {dashboard.spendByCustomer.map((row) => {
              const customer = row.customerId ? customerById.get(row.customerId) : undefined;
              return (
                <tr key={row.customerId}>
                  <td>{row.customerName}</td>
                  <td>{row.count}</td>
                  <td className="amount-cell">{formatYuan(row.amountCents)}</td>
                  <td className="amount-cell">{formatYuan(row.unpaidCents || 0)}</td>
                  <td>
                    {customer?.status === "CONFIRMED" ? (
                      <span className="badge green">
                        <CheckCircle size={12} aria-hidden="true" /> 已确认
                      </span>
                    ) : (
                      <span className="badge amber">
                        <Clock3 size={12} aria-hidden="true" /> 待确认
                      </span>
                    )}
                  </td>
                  <td>{customer?.owner?.displayName || "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
