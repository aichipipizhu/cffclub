import ExcelJS from "exceljs";

import { centsToYuan, billableHoursLabel, shortOrderCode } from "@/lib/domain";
import { parseDateRange, requireAdmin, wrapRoute } from "@/lib/http";
import { getAdminDashboard } from "@/lib/reporting";

export const GET = wrapRoute(async (request: Request) => {
  await requireAdmin();
  const range = parseDateRange(new URL(request.url));
  const dashboard = await getAdminDashboard(range);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "kabuda-reporting";

    const ledger = workbook.addWorksheet("流水");
    ledger.columns = [
      { header: "单号", key: "orderCode", width: 16 },
      { header: "老板", key: "customer", width: 14 },
      { header: "品类", key: "category", width: 14 },
      { header: "陪玩", key: "player", width: 14 },
      { header: "状态", key: "status", width: 14 },
      { header: "收款", key: "payment", width: 10 },
      { header: "发薪", key: "payroll", width: 10 },
      { header: "开始时间", key: "startAt", width: 20 },
      { header: "结束时间", key: "endAt", width: 20 },
      { header: "时长", key: "hours", width: 10 },
      { header: "单价", key: "unitPrice", width: 10 },
      { header: "总价", key: "gross", width: 10 },
      { header: "平台抽成", key: "platform", width: 12 },
      { header: "陪玩酬劳", key: "payout", width: 12 },
      { header: "归属提成", key: "ownerCommission", width: 12 },
      { header: "归属人", key: "owner", width: 14 },
      { header: "备注", key: "note", width: 20 },
    ];
    ledger.addRows(
      dashboard.items.map((item) => ({
        orderCode: shortOrderCode(item.order.code),
        customer: item.order.customer.name,
        category: item.order.category.name,
        player: item.player.displayName,
        status: item.status,
        payment: item.order.paymentStatus,
        payroll: item.payrollStatus,
        startAt: item.startAt,
        endAt: item.endAt,
        hours: billableHoursLabel(item.billableMinutes),
        unitPrice: centsToYuan(item.unitPriceCents),
        gross: centsToYuan(item.grossAmountCents),
        platform: centsToYuan(item.platformCommissionCents),
        payout: centsToYuan(item.playerPayoutCents),
        ownerCommission: centsToYuan(item.ownerCommissionCents),
        owner: item.order.customer.owner?.displayName || "",
        note: item.note || "",
      })),
    );

    const payroll = workbook.addWorksheet("员工周结");
    payroll.columns = [
      { header: "陪玩", key: "playerName", width: 16 },
      { header: "单数", key: "count", width: 10 },
      { header: "应发", key: "amount", width: 12 },
      { header: "未发", key: "unpaid", width: 12 },
    ];
    payroll.addRows(
      dashboard.payrollByPlayer.map((row) => ({
        playerName: row.playerName,
        count: row.count,
        amount: centsToYuan(row.amountCents),
        unpaid: centsToYuan(row.unpaidCents),
      })),
    );

    const customers = workbook.addWorksheet("老板消费");
    customers.columns = [
      { header: "老板", key: "customerName", width: 16 },
      { header: "单数", key: "count", width: 10 },
      { header: "消费", key: "amount", width: 12 },
      { header: "未收", key: "unpaid", width: 12 },
    ];
    customers.addRows(
      dashboard.spendByCustomer.map((row) => ({
        customerName: row.customerName,
        count: row.count,
        amount: centsToYuan(row.amountCents),
        unpaid: centsToYuan(row.unpaidCents),
      })),
    );

    for (const sheet of workbook.worksheets) {
      sheet.getRow(1).font = { bold: true };
      sheet.views = [{ state: "frozen", ySplit: 1 }];
    }

    const buffer = await workbook.xlsx.writeBuffer();
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="kabuda-report-${Date.now()}.xlsx"`,
    },
  });
});
