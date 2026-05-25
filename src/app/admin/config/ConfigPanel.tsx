"use client";

import type { ToastApi } from "@/app/_components/feedback";
import type { DashboardDto, UserDto } from "@/lib/types";

import { AccountCreateForm } from "./AccountCreateForm";
import { CategoryTable } from "./CategoryTable";
import { CustomerTable } from "./CustomerTable";
import { GlobalSettings } from "./GlobalSettings";
import { OverrideMatrix } from "./OverrideMatrix";

export function ConfigPanel({
  dashboard,
  players,
  onSaved,
  toast,
}: {
  dashboard: DashboardDto;
  players: UserDto[];
  onSaved: () => Promise<void>;
  toast: ToastApi;
}) {
  return (
    <section className="config-workspace">
      <OverrideMatrix dashboard={dashboard} players={players} onSaved={onSaved} toast={toast} />
      <div className="config-grid">
        <CategoryTable categories={dashboard.categories} onSaved={onSaved} toast={toast} />
        <div className="config-side-stack">
          <AccountCreateForm onSaved={onSaved} toast={toast} />
          <GlobalSettings toast={toast} />
        </div>
      </div>
      <CustomerTable customers={dashboard.customers} players={players} onSaved={onSaved} toast={toast} />
    </section>
  );
}

