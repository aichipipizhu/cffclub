import type { ItemStatus, PaymentStatus, PayrollStatus } from "@/lib/domain";

export type UserDto = {
  id: string;
  username?: string;
  displayName: string;
  role: "ADMIN" | "PLAYER";
  active?: boolean;
};

export type CustomerDto = {
  id: string;
  name: string;
  wechat?: string | null;
  note?: string | null;
  status: "PENDING" | "CONFIRMED";
  ownerId?: string | null;
  owner?: Pick<UserDto, "id" | "displayName"> | null;
  aliases?: { alias: string }[];
};

export type CategoryDto = {
  id: string;
  name: string;
  platformCommissionRateBps: number;
  active?: boolean;
};

export type OrderItemDto = {
  id: string;
  status: ItemStatus;
  payrollStatus: PayrollStatus;
  startAt: string;
  endAt?: string | null;
  billableMinutes: number;
  unitPriceCents: number;
  grossAmountCents: number;
  platformCommissionRateBps: number;
  platformCommissionCents: number;
  playerPayoutCents: number;
  ownerCommissionRateBps: number;
  ownerCommissionCents: number;
  gameId?: string | null;
  note?: string | null;
  rejectedReason?: string | null;
  player: UserDto;
  order: {
    id: string;
    code: string;
    paymentStatus: PaymentStatus;
    customer: CustomerDto;
    category: CategoryDto;
  };
};

export type SummaryRowDto = {
  playerId?: string;
  playerName?: string;
  customerId?: string;
  customerName?: string;
  amountCents: number;
  unpaidCents: number;
  count: number;
};

export type DashboardDto = {
  totals: {
    approvedCount: number;
    grossAmountCents: number;
    unpaidAmountCents: number;
    platformCommissionCents: number;
    playerPayoutCents: number;
    ownerCommissionCents: number;
    unpaidPayrollCents: number;
    platformNetCents: number;
  };
  items: OrderItemDto[];
  itemPage: {
    limit: number;
    hasMore: boolean;
  };
  customers: CustomerDto[];
  users: UserDto[];
  categories: CategoryDto[];
  payrollByPlayer: SummaryRowDto[];
  spendByCustomer: SummaryRowDto[];
  ownerCommissionByPlayer: SummaryRowDto[];
};

export type MobileBootstrapDto = {
  customers: CustomerDto[];
  categories: CategoryDto[];
  activeItems: OrderItemDto[];
};
