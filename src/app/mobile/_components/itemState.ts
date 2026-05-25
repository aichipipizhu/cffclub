import type { OrderItemDto } from "@/lib/types";

export function upsertItem(items: OrderItemDto[], item: OrderItemDto) {
  const exists = items.some((current) => current.id === item.id);
  if (!exists) return [item, ...items];
  return items.map((current) => (current.id === item.id ? item : current));
}
